# ChatSheetAI Implementation Plan

Based on the architectural assessment, this document outlines a detailed implementation plan to address the identified issues and improve the overall stability and functionality of the ChatSheetAI application.

## Phase 1: Critical Fixes (Immediate Priority)

### 0. Fix LLM Context and System Prompt

#### Issue

The LLM doesn't understand that it already has the context of the sheet and doesn't have access to sheet data when a new chat is started. This leads to the LLM asking for information it should already have, such as column IDs.

#### Implementation Steps

1. **Automatically Load Sheet Data on Session Start**

   - Modify the session creation process to automatically load sheet data
   - Store sheet data in the session context
   - Ensure sheet data is refreshed periodically to stay current

2. **Enhance System Prompt with Detailed Sheet Context**

   - Update the system prompt to include comprehensive sheet information
   - Include column IDs and types in the system prompt
   - Add explicit examples of how to use each tool
   - Provide clear instructions on how to reference columns and rows

3. **Implement Proactive Sheet Data Loading**

   - Load sheet data when a new chat session is created, not just on explicit request
   - Add a background process to refresh sheet data periodically
   - Cache sheet data for better performance

4. **Add Tool Usage Examples in System Prompt**
   - Include specific examples of how to use each tool
   - Show how to reference column IDs and row IDs
   - Demonstrate common operations like adding rows, updating cells, etc.

#### Files to Modify

- `server/routes/messages.ts` - Update system prompt and sheet data loading
- `server/routes/sessions.ts` - Add sheet data loading on session creation
- `server/services/llm.ts` - Enhance prompt handling and tool integration

#### Example System Prompt Enhancement

```
You are an AI assistant that helps users analyze and interact with their Smartsheet data.
The current sheet ID is {sheetId}.

Sheet Information:
Name: {sheetName}
Columns: {columns with IDs and types}
Total Rows: {totalRows}

Column Structure:
{detailed column information including IDs}

Sample data from the first few rows:
{sample data}

You can perform the following operations on this sheet using these tools:

1. Add a new row:
   Example: To add a row with ID=90, use the addRow tool with:
   {
     "cells": [
       {"columnId": "columnIdForID", "value": "90"},
       {"columnId": "anotherColumnId", "value": "some value"}
     ]
   }

2. Update a cell:
   Example: To update a cell, use the updateCell tool with:
   {
     "rowId": "rowId",
     "columnName": "columnName",
     "value": "new value"
   }

[Additional examples for other tools...]

When a user asks you to perform an operation, use the appropriate tool directly without asking for additional information that is already available in this context.
```

### 1. Fix Azure OpenAI API Configuration

#### Issue

The error message indicates that the Azure OpenAI service is configured to use private endpoints only, but the application is attempting to access it via public endpoints.

#### Implementation Steps

1. **Review Current Configuration**

   - Examine the current Azure OpenAI API configuration in the application
   - Check environment variables and configuration files
   - Identify where the API endpoint is defined

2. **Update API Endpoint Configuration**

   - Update the Azure OpenAI API endpoint to use the correct private endpoint
   - Ensure proper authentication is configured for the private endpoint
   - Update any related configuration parameters (API version, deployment name, etc.)

3. **Implement Better Error Handling**

   - Add specific error handling for Azure OpenAI API connectivity issues
   - Implement clear error messages for configuration-related problems
   - Add logging to track API request/response cycles

4. **Test API Connectivity**
   - Create a simple test script to verify connectivity to the Azure OpenAI API
   - Ensure proper authentication and authorization
   - Validate that the API returns expected responses

#### Files to Modify

- `server/services/llm.ts` - Update API endpoint configuration and error handling
- `.env` or `.env.example` - Update environment variable documentation
- `server/routes/messages.ts` - Enhance error handling for API issues

### 2. Address React Hooks Issues

#### Issue

The application is experiencing the "Rendered more hooks than during the previous render" error, which indicates inconsistent hook usage across renders.

#### Implementation Steps

1. **Analyze Component Rendering Paths**

   - Review the component tree to identify conditional rendering that affects hooks
   - Check for components that might be unmounted and remounted unexpectedly
   - Identify hooks that might be called conditionally

2. **Fix FullscreenSheetIdModal Component**

   - Simplify the modal's rendering logic to ensure consistent hook execution
   - Move state initialization outside of conditional blocks
   - Ensure hooks are called in the same order on every render

3. **Refactor ChatInterface Component**

   - Review and simplify state management
   - Ensure consistent hook usage patterns
   - Consider extracting complex logic into custom hooks

4. **Update Home Component**
   - Ensure consistent rendering of child components
   - Remove any conditional rendering that affects hook execution
   - Simplify the split panel implementation

#### Files to Modify

- `client/src/components/smartsheet/fullscreen-sheet-id-modal.tsx`
- `client/src/components/chat/chat-interface.tsx`
- `client/src/pages/home.tsx`

## Phase 2: Stability Improvements (Short-term Priority)

### 1. Enhance Session Management

#### Issue

There appear to be issues with session management, particularly when transitioning between the chat interface and the sheet ID modal.

#### Implementation Steps

1. **Implement Robust Session Validation**

   - Create a centralized session validation mechanism
   - Ensure consistent session ID handling across components
   - Add session recovery logic for expired or invalid sessions

2. **Improve Session Creation Flow**

   - Streamline the session creation process
   - Add proper error handling for session creation failures
   - Implement retry logic for transient failures

3. **Enhance Session State Management**
   - Update the SmartsheetProvider to handle session state more robustly
   - Implement proper session lifecycle management
   - Add clear error messaging for session-related issues

#### Files to Modify

- `client/src/lib/smartsheet-context.tsx`
- `server/routes/sessions.ts`
- `server/middleware/smartsheet-auth.ts`

### 2. Improve Component Integration

#### Issue

The integration between the chat interface and the sheet viewer may not be properly synchronized, leading to state inconsistencies.

#### Implementation Steps

1. **Implement Event System**

   - Create a simple pub/sub event system for cross-component communication
   - Define clear events for important state changes
   - Ensure components can subscribe to relevant events

2. **Synchronize State Updates**

   - Ensure consistent state updates across components
   - Implement proper data flow patterns
   - Add synchronization mechanisms for critical operations

3. **Enhance WebSocket Integration**
   - Improve the WebSocket service to handle more event types
   - Ensure proper reconnection logic
   - Add better error handling for WebSocket failures

#### Files to Modify

- `client/src/lib/smartsheet-context.tsx`
- `client/src/hooks/use-sheet-updates.ts`
- `server/services/websocket.ts`

## Phase 3: Long-term Enhancements (Future Priority)

### 1. Refactor State Management

#### Implementation Steps

1. **Evaluate State Management Options**

   - Research appropriate state management libraries (Redux, Zustand, Jotai, etc.)
   - Consider the specific needs of the application
   - Choose a solution that balances complexity and functionality

2. **Implement Centralized State Management**

   - Migrate existing state to the chosen solution
   - Separate UI state from application state
   - Implement proper data flow patterns

3. **Update Components to Use New State Management**
   - Refactor components to use the new state management solution
   - Ensure consistent state access patterns
   - Add proper error handling for state operations

### 2. Enhance Error Handling and Resilience

#### Implementation Steps

1. **Implement Comprehensive Error Boundaries**

   - Add error boundaries at appropriate levels in the component tree
   - Ensure proper error reporting
   - Implement graceful degradation for component failures

2. **Add Retry Mechanisms**

   - Implement retry logic for transient failures
   - Add exponential backoff for repeated failures
   - Ensure proper timeout handling

3. **Improve User Feedback**
   - Enhance error messaging for better user understanding
   - Add loading states for long-running operations
   - Implement proper notification system for important events

## Implementation Timeline

### Week 1: Critical Fixes

- Day 1-2: Fix Azure OpenAI API Configuration
- Day 3-5: Address React Hooks Issues
- Day 5: Testing and validation

### Week 2: Stability Improvements

- Day 1-3: Enhance Session Management
- Day 4-5: Improve Component Integration
- Day 5: Testing and validation

### Week 3+: Long-term Enhancements

- Week 3: Research and plan state management refactoring
- Week 4: Implement centralized state management
- Week 5: Enhance error handling and resilience
- Week 6: Final testing and documentation

## Success Criteria

1. **Azure OpenAI API**

   - Successful connection to the Azure OpenAI API
   - Proper error handling for API issues
   - Clear error messages for configuration problems

2. **React Hooks**

   - No more "Rendered more hooks than during the previous render" errors
   - Consistent component rendering
   - Stable application behavior

3. **Session Management**

   - Reliable session creation and validation
   - Proper error recovery for session failures
   - Consistent session state across components

4. **Component Integration**
   - Synchronized state between chat interface and sheet viewer
   - Reliable real-time updates
   - Consistent user experience

## Conclusion

This implementation plan addresses the critical issues identified in the architectural assessment and provides a clear path forward for improving the ChatSheetAI application. By focusing on the most critical issues first and then moving on to stability improvements and long-term enhancements, we can ensure a stable and reliable application that meets user needs.

The most immediate priority is to fix the Azure OpenAI API configuration issue, as this is preventing the core AI functionality from working. Once this is resolved, we can address the React hooks issues and session management to improve overall application stability.
