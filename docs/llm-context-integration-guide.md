# LLM Context Integration Guide

## Overview

This document provides guidance on integrating the newly added LLM context enhancement functions into the chat completion workflow. These functions enhance the system prompt with sheet context, load sheet data proactively, and manage conversation context length.

## New Functions

The following functions have been added to `server/services/llm.ts`:

1. **enhanceSystemPrompt(originalPrompt, sheetContext)** - Appends sheet context to an existing system prompt
2. **loadSheetData(sheetId)** - Simulates proactive loading of sheet data
3. **pruneConversationContext(conversation, maxLength)** - Prunes long conversation context

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
      value: JSON.stringify(sheetData),
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

    const sheetData = sheetDataState ? JSON.parse(sheetDataState.value) : null;

    // Create base system prompt
    const baseSystemPrompt = `You are an AI assistant for the ChatSheetAI application. Your role is to help users analyze and interact with their Smartsheet data.`;

    // Enhance system prompt with sheet context
    const enhancedSystemPrompt = sheetData
      ? enhanceSystemPrompt(baseSystemPrompt, sheetData)
      : baseSystemPrompt;

    // Get conversation history
    const history = await getConversationHistory(sessionId);

    // Prune conversation context if needed
    const prunedHistory = pruneConversationContext(history, 4000); // 4000 tokens max

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

### 3. Update the Chat Interface Component

Update the chat interface component in `client/src/components/chat/chat-interface.tsx` to handle the enhanced context:

```typescript
// In client/src/components/chat/chat-interface.tsx

// When sending a message
const sendMessage = async (content: string) => {
  try {
    setIsLoading(true);

    // Send message to server
    const response = await api.post(`/sessions/${sessionId}/messages`, {
      content,
    });

    // Update messages state
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", content },
      { role: "assistant", content: response.data.content },
    ]);

    setIsLoading(false);
  } catch (error) {
    console.error("Error sending message:", error);
    setIsLoading(false);
    // Show error message
  }
};
```

## Function Usage Examples

### enhanceSystemPrompt

This function enhances a base system prompt with sheet context:

```typescript
// Example usage
const basePrompt = "You are an AI assistant for the ChatSheetAI application.";
const sheetContext = {
  name: "Project Tracker",
  columns: [
    { name: "Task", type: "TEXT" },
    { name: "Status", type: "PICKLIST" },
    { name: "Due Date", type: "DATE" },
  ],
  sampleData: [
    {
      Task: "Complete documentation",
      Status: "In Progress",
      "Due Date": "2025-03-15",
    },
    { Task: "Review code", Status: "Not Started", "Due Date": "2025-03-20" },
  ],
};

const enhancedPrompt = enhanceSystemPrompt(basePrompt, sheetContext);
```

### loadSheetData

This function loads sheet data for a given sheet ID:

```typescript
// Example usage
const sheetId = "1234567890";
const sheetData = await loadSheetData(sheetId);
```

### pruneConversationContext

This function prunes a conversation context to a specified maximum length:

```typescript
// Example usage
const conversation = [
  { role: "system", content: "You are an AI assistant." },
  { role: "user", content: "What is the status of task 1?" },
  { role: "assistant", content: "Task 1 is in progress." },
  // ... many more messages
];

const prunedConversation = pruneConversationContext(conversation, 4000);
```

## Testing the Integration

To test the integration of these new functions:

1. **Create a new session** with a sheet ID to verify that sheet data is loaded proactively
2. **Send a message** to verify that the system prompt is enhanced with sheet context
3. **Send multiple messages** to verify that the conversation context is pruned appropriately

## Error Handling

Ensure proper error handling for each integration point:

1. **Sheet Data Loading**: Handle cases where sheet data cannot be loaded
2. **System Prompt Enhancement**: Ensure the system prompt is still usable even if sheet context is not available
3. **Context Pruning**: Handle edge cases where pruning might remove important context

## Monitoring and Logging

Add logging to track the usage and effectiveness of these functions:

```typescript
// Example logging
console.log(
  `[LLM Context] Enhancing system prompt with sheet context for sheet ${sheetId}`
);
console.log(
  `[LLM Context] Pruned conversation from ${conversation.length} to ${prunedConversation.length} messages`
);
```

## Conclusion

By integrating these new functions into the chat completion workflow, the AI assistant will have richer context about the sheet data, leading to more accurate and helpful responses. The proactive loading of sheet data ensures that this context is available immediately, and the context pruning ensures that long conversations remain manageable within token limits.

These enhancements align with the LLM Context Enhancement Plan and represent a significant step forward in improving the AI assistant's capabilities.
