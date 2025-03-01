# LLM Context Integration - Updated Guide

## Overview

This document provides guidance on integrating the newly added LLM context enhancement functions into the chat completion workflow. These functions have been added to `server/services/llm.ts` and are now available for use throughout the application.

## New Functions

The following functions have been added to `server/services/llm.ts`:

1. **enhanceSystemPrompt(originalPrompt: string, sheetContext: string): string**

   - Appends sheet context to an existing system prompt
   - Simple implementation that concatenates the original prompt with the sheet context

2. **loadSheetData(sheetId: string): Promise<string>**

   - Currently a placeholder that simulates proactive loading of sheet data
   - Returns a simple string with the sheet ID
   - Will need to be replaced with actual sheet data loading logic

3. **pruneConversationContext(conversation: string, maxLength: number): string**
   - Prunes long conversation context to a manageable length
   - Simple implementation that keeps the first 100 characters and the last 100 characters
   - Adds a "[pruned]" indicator in the middle

## Current Implementation

```typescript
export function enhanceSystemPrompt(
  originalPrompt: string,
  sheetContext: string
): string {
  return `${originalPrompt}\n\nSheet Context:\n${sheetContext}`;
}

export async function loadSheetData(sheetId: string): Promise<string> {
  // Simulate proactive loading of sheet data. Replace with actual logic as needed.
  return `Data for sheet ${sheetId}`;
}

export function pruneConversationContext(
  conversation: string,
  maxLength: number
): string {
  if (conversation.length <= maxLength) return conversation;
  const start = conversation.slice(0, 100);
  const end = conversation.slice(-100);
  return `${start}\n... [pruned] ...\n${end}`;
}
```

## Integration Steps

### 1. Update Session Creation to Load Sheet Data

Modify the session creation process in `server/routes/sessions.ts` to load sheet data proactively:

```typescript
// In server/routes/sessions.ts
import { loadSheetData } from "../services/llm";

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

    // Load sheet data proactively
    const sheetData = await loadSheetData(sheetId);

    // Store sheet data in session state
    await db.insert(sessionState).values({
      session_id: session.id,
      key: "sheetData",
      value: sheetData,
    });

    res.json({ session });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});
```

### 2. Enhance System Prompt in Message Processing

Update the message processing in `server/routes/messages.ts` to enhance the system prompt with sheet context:

```typescript
// In server/routes/messages.ts
import { enhanceSystemPrompt, pruneConversationContext } from "../services/llm";

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

    const sheetData = sheetDataState ? sheetDataState.value : null;

    // Create base system prompt
    const baseSystemPrompt = `You are an AI assistant for the ChatSheetAI application. Your role is to help users analyze and interact with their Smartsheet data.`;

    // Enhance system prompt with sheet context
    const enhancedSystemPrompt = sheetData
      ? enhanceSystemPrompt(baseSystemPrompt, sheetData)
      : baseSystemPrompt;

    // Get conversation history as a string
    const history = await getConversationHistory(sessionId);
    const historyString = history
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    // Prune conversation context if needed
    const prunedHistoryString = pruneConversationContext(historyString, 4000); // 4000 characters max

    // Convert pruned history string back to messages array
    const prunedHistory = prunedHistoryString.split("\n").map((line) => {
      const [role, content] = line.split(": ");
      return { role, content };
    });

    // Create messages array for LLM
    const messages = [
      { role: "system", content: enhancedSystemPrompt },
      ...prunedHistory,
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
```

## Necessary Enhancements

The current implementation is a good starting point, but several enhancements are needed:

### 1. Improve Sheet Data Loading

The `loadSheetData` function currently returns a placeholder string. It should be enhanced to:

```typescript
export async function loadSheetData(sheetId: string): Promise<string> {
  try {
    // Get sheet data from Smartsheet API
    const sheetData = await sheetDataService.getSheetData(sheetId);

    // Format sheet data as context
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

    return `Sheet Name: ${sheetData.name}
Sheet ID: ${sheetData.id}
Last Updated: ${new Date(sheetData.modifiedAt).toISOString()}

Columns:
${columnsInfo}

Sample Data:
${sampleData}`;
  } catch (error) {
    console.error("Error loading sheet data:", error);
    return `Unable to load data for sheet ${sheetId}`;
  }
}
```

### 2. Improve Conversation Context Pruning

The `pruneConversationContext` function currently works with strings, but it should work with the `ChatMessage` array directly:

```typescript
export function pruneConversationContext(
  conversation: ChatMessage[],
  maxTokens: number = 4000
): ChatMessage[] {
  // Estimate token count (rough approximation)
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);

  // Calculate current token count
  let totalTokens = conversation.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );

  // If under limit, return unchanged
  if (totalTokens <= maxTokens) {
    return conversation;
  }

  // Keep system message and recent messages
  const systemMessages = conversation.filter((msg) => msg.role === "system");
  let userAssistantMessages = conversation.filter(
    (msg) => msg.role !== "system"
  );

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

## Testing the Integration

To test the integration of these functions:

1. **Create a new session** with a sheet ID to verify that sheet data is loaded proactively
2. **Send a message** to verify that the system prompt is enhanced with sheet context
3. **Send multiple messages** to verify that the conversation context is pruned appropriately

## Next Steps

1. **Implement the enhanced sheet data loading** function to replace the placeholder
2. **Update the conversation context pruning** function to work with ChatMessage arrays
3. **Integrate these functions** into the session creation and message processing workflows
4. **Test the integration** to ensure it works as expected

## Conclusion

The addition of these functions to the LLM service module is a significant step towards enhancing the AI assistant's capabilities. By integrating them into the chat completion workflow, we can provide richer context for the assistant and manage conversation length effectively.

The next steps involve enhancing these functions to work with actual sheet data and ChatMessage arrays, and integrating them into the session creation and message processing workflows.
