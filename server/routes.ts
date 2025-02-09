import { Router } from 'express';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { SmartsheetTools, smartsheetTools } from './tools/smartsheet.js';
import { jobsRouter } from './routes/jobs.js';
import { 
  getMessages, 
  saveMessage, 
  clearMessages, 
  createSession,
  getSessions,
  getCurrentSession,
  getSession,
  type StorageState 
} from './storage.js';
import { type ColumnMetadata } from '../shared/schema.js';

const router = Router();

// Mount jobs router
router.use(jobsRouter);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const smartsheet = new SmartsheetTools(process.env.SMARTSHEET_ACCESS_TOKEN || '');

// Get chat history
router.get('/api/messages', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ 
      success: false, 
      error: 'sessionId is required' 
    });
  }
  
  // Verify session exists
  const session = getSession(sessionId as string);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }
  
  const messages = getMessages(sessionId as string);
  res.json(messages);
});

// Get sessions
router.get('/api/sessions', (req, res) => {
  const sessions = getSessions();
  res.json(sessions);
});

// Create new session
router.post('/api/sessions', async (req, res) => {
  try {
    const { sheetId } = req.body;
    if (!sheetId) {
      return res.status(400).json({ error: 'sheetId is required' });
    }

    // Get sheet info and data for the session
    const [infoResult, dataResult] = await Promise.all([
      smartsheet.getSheetInfo({ sheetId }),
      smartsheet.getSheetData({ sheetId })
    ]);

    const sessionId = createSession(sheetId, infoResult.data.sheetName);
    
    // Create system message with sheet metadata and sample data
    const timestamp = new Date().toISOString();
    saveMessage({
      role: 'system',
      content: `Sheet Information:
Name: ${infoResult.data.sheetName}
Total Rows: ${infoResult.data.totalRows}

Columns:
${infoResult.data.columns.map((col: ColumnMetadata) => `
- ${col.title}
  Type: ${col.type}
  ${col.options ? `Options: ${col.options.join(', ')}` : ''}
  ${col.systemColumn ? '(System Column)' : col.isEditable ? '(Editable)' : '(Read-only)'}
`).join('\n')}

Sample Data (3 rows):
${JSON.stringify(dataResult.data.rows.slice(0, 3), null, 2)}`,
      timestamp,
      metadata: {
        sessionId,
        sheetId,
        timestamp,
        operation: 'initialize',
        status: 'success'
      }
    });

    res.json({ sessionId });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create session' 
    });
  }
});

// Send a message and get AI response
router.post('/api/messages', async (req, res) => {
  try {
    const { content, role, metadata } = req.body;
    
    // Validate session if metadata contains sessionId
    if (metadata?.sessionId) {
      const session = getSession(metadata.sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }
    }
    
    // Save user message
    const userMessage = {
      role,
      content,
      metadata,
      timestamp: new Date().toISOString()
    };
    saveMessage(userMessage);

    // Get chat history for context (limit to last 10 messages)
    const chatHistory: ChatCompletionMessageParam[] = getMessages(metadata?.sessionId)
      .slice(-10) // Only keep last 10 messages
      .flatMap((msg): ChatCompletionMessageParam[] => {
      switch (msg.role) {
        case 'function':
          if (!msg.name) return []; // Skip if no name
          const functionMsg: ChatCompletionMessageParam = {
            role: 'function' as const,
            name: msg.name,
            content: msg.content
          };
          // Add tool_call_id if it exists in the original message
          if ('function_call' in msg && msg.function_call?.id) {
            (functionMsg as any).tool_call_id = msg.function_call.id;
          }
          return [functionMsg];
        case 'assistant':
          return [{
            role: 'assistant' as const,
            content: msg.content
          }];
        case 'user':
          return [{
            role: 'user' as const,
            content: msg.content
          }];
        case 'system':
          return [{
            role: 'system' as const,
            content: msg.content
          }];
        default:
          return []; // Skip unknown roles
      }
    });

    // Get AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: chatHistory,
      tools: smartsheetTools,
      tool_choice: "auto"
    });

    const assistantResponse = completion.choices[0].message;

    // Handle function calls
    if (assistantResponse.tool_calls) {
      // Execute and collect all function responses
      const functionResponses = new Map<string, any>();
      
      for (const toolCall of assistantResponse.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        let functionResponse;
        switch (functionName) {
          case 'openSheet':
            functionResponse = await smartsheet.openSheet(functionArgs);
            break;
          case 'addColumn':
            functionResponse = await smartsheet.addColumn(functionArgs);
            break;
          case 'getSheetData':
            functionResponse = await smartsheet.getSheetData(functionArgs);
            break;
          case 'getSheetInfo':
            functionResponse = await smartsheet.getSheetInfo(functionArgs);
            break;
          default:
            throw new Error(`Unknown function: ${functionName}`);
        }

        functionResponses.set(toolCall.id, functionResponse);

        const timestamp = new Date().toISOString();
        // Save function response with metadata
        saveMessage({
          role: 'function',
          name: functionName,
          content: JSON.stringify(functionResponse),
          timestamp,
          function_call: { id: toolCall.id },
          metadata: {
            sessionId: metadata?.sessionId,
            sheetId: functionArgs.sheetId,
            operation: functionName,
            status: functionResponse.success ? 'success' : 'error',
            timestamp
          }
        });
      }

      // Construct final messages with reduced context for sheet info investigation.
      let finalMessages: ChatCompletionMessageParam[];
      const infoCalls = (assistantResponse.tool_calls ?? []).filter(tc => tc.function.name === "getSheetInfo");
      if (infoCalls.length > 0) {
        finalMessages = [
          ...chatHistory,
          {
            role: 'assistant',
            content: assistantResponse.content || '',
            tool_calls: assistantResponse.tool_calls ?? []
          } satisfies ChatCompletionMessageParam,
          ...infoCalls.map(toolCall => ({
            role: 'function' as const,
            name: toolCall.function.name,
            content: JSON.stringify(functionResponses.get(toolCall.id)),
            tool_call_id: toolCall.id
          }))
        ];
      } else {
        finalMessages = [
          ...chatHistory,
          {
            role: 'assistant',
            content: assistantResponse.content || '',
            tool_calls: assistantResponse.tool_calls ?? []
          } satisfies ChatCompletionMessageParam,
          ...(assistantResponse.tool_calls ?? []).map(toolCall => ({
            role: 'function' as const,
            name: toolCall.function.name,
            content: JSON.stringify(functionResponses.get(toolCall.id)),
            tool_call_id: toolCall.id
          }))
        ];
      }
      
      const secondResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: finalMessages
      });

      const finalResponse = secondResponse.choices[0].message;
      
      // Prefer the getSheetInfo response over others for metadata
      const infoResponseEntry = Array.from(functionResponses.entries()).find(([id, response]) => {
        const toolCall = assistantResponse.tool_calls?.find(tc => tc.id === id);
        return toolCall && toolCall.function.name === "getSheetInfo";
      });
      const responseMetadata = infoResponseEntry ? 
        ('metadata' in infoResponseEntry[1] ? infoResponseEntry[1].metadata : infoResponseEntry[1].data) : 
        null;
      
      saveMessage({
        role: 'assistant',
        content: finalResponse.content || '',
        timestamp: new Date().toISOString(),
        metadata: {
          ...responseMetadata,
          sessionId: metadata?.sessionId
        }
      });
    } else {
      const timestamp = new Date().toISOString();
      // Save direct assistant response if no function calls
      saveMessage({
        role: 'assistant',
        content: assistantResponse.content || '',
        timestamp,
        metadata: {
          sessionId: metadata?.sessionId,
          timestamp,
          status: 'success'
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error processing message:', error);
    if (error instanceof Error) {
      res.status(500).json({ 
        error: 'Failed to process message',
        details: error.message 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to process message',
        details: 'An unknown error occurred' 
      });
    }
  }
});

// Clear chat history
router.delete('/api/messages', (req, res) => {
  const { sessionId } = req.query;
  clearMessages(sessionId as string | undefined);
  res.json({ success: true });
});

// Direct Smartsheet data endpoints
router.get('/api/smartsheet/:sheetId', async (req, res) => {
  try {
    const { sheetId } = req.params;
    if (!sheetId) {
      return res.status(400).json({ 
        success: false, 
        error: 'sheetId is required' 
      });
    }

    const result = await smartsheet.getSheetData({ sheetId });
    res.json({
      success: true,
      data: {
        ...result.data,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

// Get sheet metadata only (for LLM)
router.get('/api/smartsheet/:sheetId/meta', async (req, res) => {
  try {
    const { sheetId } = req.params;
    if (!sheetId) {
      return res.status(400).json({ 
        success: false, 
        error: 'sheetId is required' 
      });
    }

    const result = await smartsheet.getSheetInfo({ sheetId });
    res.json({
      success: true,
      data: {
        sheetId,
        sheetName: result.data.sheetName,
        totalRows: result.data.totalRows,
        columns: result.data.columns
      }
    });
  } catch (error) {
    console.error('Error fetching sheet metadata:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

export { router };
export default router;
