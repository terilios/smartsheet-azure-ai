# LLM Context Enhancement Plan

## Overview

This document outlines the plan for enhancing the LLM context and system prompt in the ChatSheetAI application. The goal is to improve the AI assistant's understanding of sheet data and provide more accurate and helpful responses.

## Current Implementation

Currently, the system prompt is defined in `server/routes/messages.ts` and does not include detailed sheet context. Sheet data is loaded on demand rather than being immediately available after session creation.

## Objectives

1. **Enhanced System Prompt**: Create a more detailed system prompt that includes sheet context, such as column names, data types, and sample data.

2. **Proactive Sheet Data Loading**: Modify the session creation process to load sheet data immediately, making it available for the system prompt.

3. **Context Pruning**: Implement a strategy for managing conversation context length to prevent token limits from being exceeded.

4. **Improved Response Quality**: Ensure the AI assistant provides more accurate and helpful responses based on the enhanced context.

## Implementation Plan

### 1. Analyze Current System Prompt

**Files to Review**:

- `server/routes/messages.ts` - Contains the current system prompt implementation
- `server/services/llm.ts` - Handles communication with the LLM
- `server/routes/sessions.ts` - Manages session creation and state

**Analysis Tasks**:

- Identify how the system prompt is currently constructed
- Determine where sheet data is currently loaded
- Identify opportunities for enhancement

### 2. Design Enhanced System Prompt

**Design Considerations**:

- Include sheet metadata (column names, data types)
- Include sample data for context
- Provide instructions for handling different types of queries
- Include examples of good responses

**Example Enhanced System Prompt**:

```
You are an AI assistant for the ChatSheetAI application. Your role is to help users analyze and interact with their Smartsheet data.

Sheet Information:
- Sheet Name: {sheetName}
- Sheet ID: {sheetId}
- Last Updated: {lastUpdated}

Columns:
{columnsInfo}

Sample Data:
{sampleData}

Instructions:
1. When asked about the sheet data, provide accurate information based on the context provided.
2. If asked to perform calculations, use the data provided to calculate the result.
3. If asked to summarize the data, focus on key insights and trends.
4. If asked to filter or sort the data, explain how the data would look after applying those operations.
5. If the user asks for information that is not available in the sheet data, politely explain that you don't have that information.

Examples:
User: "What's the total revenue for Q1?"
Assistant: "Based on the sheet data, the total revenue for Q1 is $1,250,000."

User: "How many employees are in the Engineering department?"
Assistant: "According to the sheet data, there are 15 employees in the Engineering department."
```

### 3. Implement Proactive Sheet Data Loading

**Implementation Steps**:

1. **Modify Session Creation**:
   - Update `server/routes/sessions.ts` to load sheet data when creating a new session
   - Store the sheet data in the session state

```typescript
// Example implementation in server/routes/sessions.ts
router.post("/sessions", async (req, res) => {
  try {
    const { sheetId } = req.body;

    // Create session
    const session = await db
      .insert(sessions)
      .values({
        id: generateId(),
        created_at: new Date(),
        metadata: { sheetId },
      })
      .returning()
      .get();

    // Load sheet data immediately
    const sheetData = await sheetDataService.getSheetData(sheetId);

    // Store sheet data in session state
    await db.insert(sessionState).values({
      session_id: session.id,
      key: "sheetData",
      value: JSON.stringify(sheetData),
    });

    res.json({ session });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});
```

2. **Create Sheet Context Generator**:
   - Implement a utility function to generate sheet context from sheet data
   - Include column information and sample data

```typescript
// Example implementation in server/utils/sheet-context.ts
export function generateSheetContext(sheetData: SheetData): SheetContext {
  const columnsInfo = sheetData.columns
    .map(
      (column) =>
        `- ${column.title} (${column.type}): ${
          column.description || "No description"
        }`
    )
    .join("\n");

  const sampleData = sheetData.rows
    .slice(0, 5)
    .map((row) =>
      Object.entries(row.cells)
        .map(
          ([columnId, cell]) =>
            `${sheetData.columns.find((c) => c.id === columnId)?.title}: ${
              cell.value
            }`
        )
        .join(", ")
    )
    .join("\n");

  return {
    sheetName: sheetData.name,
    sheetId: sheetData.id,
    lastUpdated: sheetData.modifiedAt,
    columnsInfo,
    sampleData,
  };
}
```

### 4. Update System Prompt Generation

**Implementation Steps**:

1. **Modify Message Route**:
   - Update `server/routes/messages.ts` to include sheet context in the system prompt

```typescript
// Example implementation in server/routes/messages.ts
router.post("/sessions/:sessionId/messages", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { content } = req.body;

    // Get session and sheet data
    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();
    const sheetDataState = await db
      .select()
      .from(sessionState)
      .where(
        and(
          eq(sessionState.session_id, sessionId),
          eq(sessionState.key, "sheetData")
        )
      )
      .get();

    const sheetData = sheetDataState ? JSON.parse(sheetDataState.value) : null;

    // Generate sheet context
    const sheetContext = sheetData ? generateSheetContext(sheetData) : null;

    // Create system prompt with sheet context
    const systemPrompt = createSystemPrompt(sheetContext);

    // Get conversation history
    const history = await getConversationHistory(sessionId);

    // Create messages array for LLM
    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content },
    ];

    // Send to LLM
    const response = await llmService.getChatCompletion({ messages });

    // Save message and response
    // ...

    res.json({
      /* response */
    });
  } catch (error) {
    console.error("Error processing message:", error);
    res.status(500).json({ error: "Failed to process message" });
  }
});

function createSystemPrompt(sheetContext: SheetContext | null): string {
  let prompt = `You are an AI assistant for the ChatSheetAI application. Your role is to help users analyze and interact with their Smartsheet data.`;

  if (sheetContext) {
    prompt += `\n\nSheet Information:
- Sheet Name: ${sheetContext.sheetName}
- Sheet ID: ${sheetContext.sheetId}
- Last Updated: ${sheetContext.lastUpdated}

Columns:
${sheetContext.columnsInfo}

Sample Data:
${sheetContext.sampleData}`;
  }

  prompt += `\n\nInstructions:
1. When asked about the sheet data, provide accurate information based on the context provided.
2. If asked to perform calculations, use the data provided to calculate the result.
3. If asked to summarize the data, focus on key insights and trends.
4. If asked to filter or sort the data, explain how the data would look after applying those operations.
5. If the user asks for information that is not available in the sheet data, politely explain that you don't have that information.`;

  return prompt;
}
```

### 5. Implement Context Pruning

**Implementation Steps**:

1. **Create Context Pruning Utility**:
   - Implement a utility function to prune conversation history when it gets too long
   - Ensure important context is preserved

```typescript
// Example implementation in server/utils/context-pruning.ts
export function pruneConversationHistory(
  history: ChatMessage[],
  maxTokens: number = 4000
): ChatMessage[] {
  // Estimate token count (rough approximation)
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);

  // Calculate current token count
  let totalTokens = history.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );

  // If under limit, return unchanged
  if (totalTokens <= maxTokens) {
    return history;
  }

  // Keep system message and recent messages
  const systemMessages = history.filter((msg) => msg.role === "system");
  let userAssistantMessages = history.filter((msg) => msg.role !== "system");

  // Calculate tokens for system messages
  const systemTokens = systemMessages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );

  // Available tokens for user/assistant messages
  const availableTokens = maxTokens - systemTokens;

  // Keep most recent messages that fit within token limit
  const prunedMessages = [];
  let currentTokens = 0;

  // Start from most recent messages
  for (let i = userAssistantMessages.length - 1; i >= 0; i--) {
    const msg = userAssistantMessages[i];
    const msgTokens = estimateTokens(msg.content);

    if (currentTokens + msgTokens <= availableTokens) {
      prunedMessages.unshift(msg);
      currentTokens += msgTokens;
    } else {
      break;
    }
  }

  // Combine system messages with pruned user/assistant messages
  return [...systemMessages, ...prunedMessages];
}
```

2. **Apply Context Pruning in Message Route**:
   - Update `server/routes/messages.ts` to use the pruning utility

```typescript
// In server/routes/messages.ts
const history = await getConversationHistory(sessionId);
const prunedHistory = pruneConversationHistory(history);

const messages = [
  { role: "system", content: systemPrompt },
  ...prunedHistory,
  { role: "user", content },
];
```

### 6. Testing and Validation

**Testing Approach**:

1. **Unit Tests**:

   - Test sheet context generation
   - Test system prompt creation
   - Test context pruning

2. **Integration Tests**:

   - Test session creation with sheet data loading
   - Test message processing with enhanced system prompt

3. **Manual Testing**:
   - Test with various sheet structures and data
   - Verify response quality and accuracy
   - Test with long conversations to verify context pruning

## Expected Outcomes

1. **Improved Response Quality**: The AI assistant will provide more accurate and helpful responses based on the enhanced sheet context.

2. **Better User Experience**: Users will receive more relevant information without having to provide as much context in their queries.

3. **Efficient Context Management**: The application will handle long conversations more effectively, preventing token limit issues.

## Timeline

1. **Day 1**: Analyze current implementation and design enhanced system prompt
2. **Day 2**: Implement proactive sheet data loading
3. **Day 3**: Update system prompt generation
4. **Day 4**: Implement context pruning
5. **Day 5**: Testing and validation

## Dependencies

- Access to Azure OpenAI API (resolved with LiteLLM integration)
- Sheet data service functionality

## Risks and Mitigations

| Risk                          | Impact               | Mitigation                                        |
| ----------------------------- | -------------------- | ------------------------------------------------- |
| Token limits exceeded         | AI responses fail    | Implement effective context pruning               |
| Sheet data too large          | Performance issues   | Limit sample data size, use pagination            |
| Response quality not improved | User dissatisfaction | Iteratively refine system prompt based on testing |

## Conclusion

Enhancing the LLM context and system prompt is a critical step in improving the AI assistant's capabilities. By providing detailed sheet context and implementing proactive data loading, we can significantly improve the quality and relevance of the AI's responses. The implementation plan outlined in this document provides a clear roadmap for achieving these improvements.
