# Outstanding Development Tasks for Initial Release

Based on the architectural assessment and implementation plan, the following tasks need to be completed to achieve a stable initial release of the ChatSheetAI application.

## Critical Priority Tasks

### 0. Implement Authentication Infrastructure (AWS Cognito Preparation)

**Issue:** The application will eventually integrate with AWS Cognito for SSO/JWT authentication, and implementing this later would require significant refactoring.

**Tasks:**

1. **Create Authentication Service Layer**

   - Implement a service interface for authentication
   - Create a stub implementation for development
   - Prepare for future AWS Cognito integration

   ```typescript
   // server/services/auth.ts
   export interface User {
     id: string;
     email: string;
     name: string;
   }

   export interface AuthService {
     validateToken(token: string): Promise<User | null>;
     getDefaultUser(): User;
   }

   // Stub implementation for development
   export class StubAuthService implements AuthService {
     validateToken(token: string): Promise<User | null> {
       // During development, accept any token and return default user
       return Promise.resolve(this.getDefaultUser());
     }

     getDefaultUser(): User {
       return {
         id: "default-user-id",
         email: "default@childrens.harvard.edu",
         name: "Default User",
       };
     }
   }

   // Factory to get the appropriate auth service
   export const getAuthService = (): AuthService => {
     return new StubAuthService();
   };
   ```

2. **Update Database Schema**

   - Add users table to the database schema
   - Update sessions table to reference users
   - Create migration script for schema changes

   ```typescript
   // migrations/0001_add_users.ts
   import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

   export const users = pgTable("users", {
     id: text("id").primaryKey(),
     email: text("email").notNull().unique(),
     name: text("name"),
     createdAt: timestamp("created_at").notNull().defaultNow(),
     updatedAt: timestamp("updated_at").notNull().defaultNow(),
   });

   // Update existing sessions table to reference users
   export const sessions = pgTable("chat_sessions", {
     id: text("id").primaryKey(),
     userId: text("user_id")
       .notNull()
       .references(() => users.id),
     sheetId: text("sheet_id").notNull(),
     createdAt: timestamp("created_at").notNull().defaultNow(),
     updatedAt: timestamp("updated_at").notNull().defaultNow(),
   });
   ```

3. **Create Authentication Middleware**

   - Implement middleware to validate authentication tokens
   - Use default user for development environment
   - Prepare for JWT validation with AWS Cognito

   ```typescript
   // server/middleware/auth.ts
   import { Request, Response, NextFunction } from "express";
   import { getAuthService } from "../services/auth";

   export interface AuthenticatedRequest extends Request {
     user?: {
       id: string;
       email: string;
       name: string;
     };
   }

   export const authMiddleware = async (
     req: AuthenticatedRequest,
     res: Response,
     next: NextFunction
   ) => {
     try {
       // For development, use default user
       if (process.env.NODE_ENV !== "production") {
         req.user = getAuthService().getDefaultUser();
         return next();
       }

       const authHeader = req.headers.authorization;

       if (!authHeader) {
         return res
           .status(401)
           .json({ error: "No authorization header provided" });
       }

       const token = authHeader.split(" ")[1]; // Bearer TOKEN
       const user = await getAuthService().validateToken(token);

       if (!user) {
         return res.status(401).json({ error: "Invalid token" });
       }

       req.user = user;
       next();
     } catch (error) {
       console.error("Authentication error:", error);
       res.status(500).json({ error: "Authentication failed" });
     }
   };
   ```

4. **Update Session Management**

   - Modify session creation to include user ID
   - Update session retrieval to check user ownership
   - Add user-specific session listing

   ```typescript
   // server/storage.ts
   export const storage = {
     createSession: async (
       userId: string,
       sheetId: string
     ): Promise<string> => {
       const sessionId = uuidv4();
       await db.insert(chatSessions).values({
         id: sessionId,
         userId,
         sheetId,
         createdAt: new Date(),
         updatedAt: new Date(),
       });
       return sessionId;
     },

     // Update other methods to consider user ID
     getSessionsByUser: async (userId: string): Promise<ChatSession[]> => {
       const sessions = await db
         .select()
         .from(chatSessions)
         .where(eq(chatSessions.userId, userId));

       // Process sessions
       return sessions.map(/* ... */);
     },
   };
   ```

5. **Create Frontend Authentication Context**

   - Implement authentication context provider
   - Add hooks for accessing authentication state
   - Create stub login/logout functionality

   ```typescript
   // client/src/lib/auth-context.tsx
   import React, {
     createContext,
     useContext,
     useState,
     useEffect,
   } from "react";

   interface User {
     id: string;
     email: string;
     name: string;
   }

   interface AuthContextType {
     user: User | null;
     isAuthenticated: boolean;
   }

   const AuthContext = createContext<AuthContextType | undefined>(undefined);

   export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
     children,
   }) => {
     const [user, setUser] = useState<User | null>(null);
     const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

     // For development, use a default user
     useEffect(() => {
       setUser({
         id: "default-user-id",
         email: "default@childrens.harvard.edu",
         name: "Default User",
       });
       setIsAuthenticated(true);
     }, []);

     return (
       <AuthContext.Provider value={{ user, isAuthenticated }}>
         {children}
       </AuthContext.Provider>
     );
   };

   export const useAuth = () => {
     const context = useContext(AuthContext);
     if (context === undefined) {
       throw new Error("useAuth must be used within an AuthProvider");
     }
     return context;
   };
   ```

#### Files to Modify

- Create `server/services/auth.ts`
- Create `server/middleware/auth.ts`
- Create `migrations/0001_add_users.ts`
- Update `server/storage.ts`
- Update `server/routes/sessions.ts`
- Create `client/src/lib/auth-context.tsx`
- Update `client/src/App.tsx` to include AuthProvider

#### Benefits of This Approach

- Prepares the application for future AWS Cognito integration
- Avoids significant refactoring later
- Establishes proper user context from the beginning
- Allows testing with a default user in development

### 1. Fix LLM Context and System Prompt

**Issue:** The LLM doesn't understand that it already has the context of the sheet and doesn't have access to sheet data when a new chat is started.

**Tasks:**

1. **Automatically Load Sheet Data on Session Start**

   - Modify `server/routes/sessions.ts` to load sheet data when creating a new session
   - Store sheet data in the session context
   - Add sheet metadata to the session object

   ```typescript
   // In server/routes/sessions.ts
   router.post("/", async (req, res) => {
     try {
       const { sheetId } = req.body;
       const sessionId = await storage.createSession(sheetId);

       // Load sheet data immediately after session creation
       const sheetData = await smartsheetService.getSheetData(sheetId);
       await storage.updateSessionMetadata(sessionId, {
         sheetData: {
           columns: sheetData.columns,
           sampleData: sheetData.rows.slice(0, 5),
         },
       });

       res.json({ sessionId });
     } catch (error) {
       // Error handling
     }
   });
   ```

2. **Enhance System Prompt with Detailed Sheet Context**

   - Update `server/routes/messages.ts` to include comprehensive sheet information in the system prompt
   - Add column IDs, types, and sample data to the prompt
   - Include explicit examples of how to use each tool

   ```typescript
   // In server/routes/messages.ts
   const buildSystemPrompt = async (sessionId) => {
     const session = await storage.getSession(sessionId);
     const { sheetId, metadata } = session;
     const { columns, sampleData } = metadata.sheetData || {};

     let systemPrompt = `You are an AI assistant that helps users analyze and interact with their Smartsheet data.
     The current sheet ID is ${sheetId}.
     
     Sheet Information:
     Columns:
     ${columns
       .map((col) => `- ${col.title} (ID: ${col.id}, Type: ${col.type})`)
       .join("\n")}
     
     Sample data from the first few rows:
     ${JSON.stringify(sampleData, null, 2)}
     
     You can perform the following operations on this sheet using these tools:
     
     1. Add a new row:
        Example: To add a row, use the addRow tool with:
        {
          "cells": [
            {"columnId": "${columns[0].id}", "value": "example value"},
            {"columnId": "${columns[1].id}", "value": "example value"}
          ]
        }
     
     2. Update a cell:
        Example: To update a cell, use the updateCell tool with:
        {
          "rowId": "rowId",
          "columnId": "${columns[0].id}",
          "value": "new value"
        }
     
     When a user asks you to perform an operation, use the appropriate tool directly without asking for additional information that is already available in this context.`;

     return systemPrompt;
   };
   ```

3. **Implement Proactive Sheet Data Loading**
   - Add a background process to refresh sheet data periodically
   - Cache sheet data for better performance
   - Create a service for managing sheet data updates

### 2. Fix Azure OpenAI API Configuration

**Issue:** The Azure OpenAI service is configured to use private endpoints only, but the application is attempting to access it via public endpoints.

**Tasks:**

1. **Update API Endpoint Configuration**

   - Modify `server/services/llm.ts` to use the correct private endpoint
   - Update environment variables in `.env` file
   - Add proper error handling for API connectivity issues

   ```typescript
   // In server/services/llm.ts
   const openai = new OpenAIClient(
     process.env.AZURE_OPENAI_API_BASE,
     new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY),
     {
       apiVersion: process.env.AZURE_OPENAI_API_VERSION,
       // Add additional configuration for private endpoint
       // This might include VNet settings, managed identity, etc.
     }
   );
   ```

2. **Implement Better Error Handling**

   - Add specific error handling for Azure OpenAI API connectivity issues
   - Create clear error messages for configuration-related problems
   - Add logging to track API request/response cycles

   ```typescript
   // In server/services/llm.ts
   try {
     const response = await openai.getChatCompletions(
       process.env.AZURE_OPENAI_DEPLOYMENT,
       messages
     );
     return response;
   } catch (error) {
     if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
       console.error("Azure OpenAI API connection error:", error);
       throw new Error(
         "Unable to connect to Azure OpenAI API. Please check your network configuration and private endpoint settings."
       );
     } else if (error.statusCode === 401) {
       console.error("Azure OpenAI API authentication error:", error);
       throw new Error(
         "Authentication failed for Azure OpenAI API. Please check your API key."
       );
     } else {
       console.error("Azure OpenAI API error:", error);
       throw new Error(
         "An error occurred while communicating with Azure OpenAI API."
       );
     }
   }
   ```

3. **Test API Connectivity**
   - Create a simple test script to verify connectivity to the Azure OpenAI API
   - Ensure proper authentication and authorization
   - Validate that the API returns expected responses

### 3. Address React Hooks Issues

**Issue:** The application is experiencing the "Rendered more hooks than during the previous render" error, which indicates inconsistent hook usage across renders.

**Tasks:**

1. **Fix FullscreenSheetIdModal Component**

   - Simplify the modal's rendering logic to ensure consistent hook execution
   - Move state initialization outside of conditional blocks
   - Ensure hooks are called in the same order on every render

   ```typescript
   // In client/src/components/smartsheet/fullscreen-sheet-id-modal.tsx
   // BEFORE (problematic code with conditional hooks):
   const FullscreenSheetIdModal = ({ isOpen, onClose }) => {
     if (!isOpen) return null;

     // This is problematic because hooks are only called conditionally
     const [sheetId, setSheetId] = useState('');
     // ...
   };

   // AFTER (fixed code with consistent hooks):
   const FullscreenSheetIdModal = ({ isOpen, onClose }) => {
     // Always call hooks at the top level, regardless of isOpen
     const [sheetId, setSheetId] = useState('');
     // ...

     if (!isOpen) return null;

     return (
       // Modal content
     );
   };
   ```

2. **Refactor ChatInterface Component**

   - Review and simplify state management
   - Ensure consistent hook usage patterns
   - Extract complex logic into custom hooks

   ```typescript
   // In client/src/components/chat/chat-interface.tsx
   // Create custom hooks for specific functionality
   const useMessages = (sessionId) => {
     const [messages, setMessages] = useState([]);
     // Message loading and handling logic
     return { messages, sendMessage, loadMessages };
   };

   const ChatInterface = () => {
     // Always call hooks in the same order
     const { sessionId } = useSmartsheet();
     const { messages, sendMessage, loadMessages } = useMessages(sessionId);
     // Other hooks

     // Component logic
   };
   ```

3. **Update Home Component**
   - Ensure consistent rendering of child components
   - Remove any conditional rendering that affects hook execution
   - Simplify the split panel implementation

## High Priority Tasks

### 4. Enhance Session Management

**Issue:** There appear to be issues with session management, particularly when transitioning between the chat interface and the sheet ID modal.

**Tasks:**

1. **Implement Robust Session Validation**

   - Create a centralized session validation mechanism
   - Ensure consistent session ID handling across components
   - Add session recovery logic for expired or invalid sessions

   ```typescript
   // In client/src/lib/smartsheet-context.tsx
   const validateSession = async (sessionId) => {
     try {
       const response = await fetch(`/api/sessions/${sessionId}`);
       if (!response.ok) {
         // Session is invalid or expired
         return false;
       }
       return true;
     } catch (error) {
       console.error("Session validation error:", error);
       return false;
     }
   };

   export const SmartsheetProvider = ({ children }) => {
     const [sessionId, setSessionId] = useState(
       localStorage.getItem("sessionId")
     );
     const [isSessionValid, setIsSessionValid] = useState(false);

     useEffect(() => {
       if (sessionId) {
         validateSession(sessionId).then((valid) => {
           setIsSessionValid(valid);
           if (!valid) {
             // Clear invalid session
             localStorage.removeItem("sessionId");
             setSessionId(null);
           }
         });
       }
     }, [sessionId]);

     // Provider implementation
   };
   ```

2. **Improve Session Creation Flow**

   - Streamline the session creation process
   - Add proper error handling for session creation failures
   - Implement retry logic for transient failures

3. **Enhance Session State Management**
   - Update the SmartsheetProvider to handle session state more robustly
   - Implement proper session lifecycle management
   - Add clear error messaging for session-related issues

### 5. Improve Component Integration

**Issue:** The integration between the chat interface and the sheet viewer may not be properly synchronized, leading to state inconsistencies.

**Tasks:**

1. **Implement Event System**

   - Create a simple pub/sub event system for cross-component communication
   - Define clear events for important state changes
   - Ensure components can subscribe to relevant events

   ```typescript
   // In client/src/lib/events.ts
   export const EventTypes = {
     SHEET_DATA_UPDATED: "SHEET_DATA_UPDATED",
     CELL_UPDATED: "CELL_UPDATED",
     ROW_ADDED: "ROW_ADDED",
     ROW_DELETED: "ROW_DELETED",
   };

   class EventBus {
     private listeners = new Map();

     subscribe(event, callback) {
       if (!this.listeners.has(event)) {
         this.listeners.set(event, []);
       }
       this.listeners.get(event).push(callback);

       return () => this.unsubscribe(event, callback);
     }

     unsubscribe(event, callback) {
       if (!this.listeners.has(event)) return;
       const callbacks = this.listeners.get(event);
       this.listeners.set(
         event,
         callbacks.filter((cb) => cb !== callback)
       );
     }

     publish(event, data) {
       if (!this.listeners.has(event)) return;
       this.listeners.get(event).forEach((callback) => callback(data));
     }
   }

   export const eventBus = new EventBus();
   ```

2. **Synchronize State Updates**

   - Ensure consistent state updates across components
   - Implement proper data flow patterns
   - Add synchronization mechanisms for critical operations

   ```typescript
   // In client/src/components/smartsheet/sheet-viewer.tsx
   useEffect(() => {
     const unsubscribe = eventBus.subscribe(
       EventTypes.SHEET_DATA_UPDATED,
       (data) => {
         setSheetData(data);
       }
     );

     return () => unsubscribe();
   }, []);
   ```

3. **Enhance WebSocket Integration**

   - Improve the WebSocket service to handle more event types
   - Ensure proper reconnection logic
   - Add better error handling for WebSocket failures

   ```typescript
   // In client/src/hooks/use-sheet-updates.ts
   export const useSheetUpdates = (sheetId) => {
     const [isConnected, setIsConnected] = useState(false);
     const socketRef = useRef(null);

     useEffect(() => {
       if (!sheetId) return;

       const connectWebSocket = () => {
         const socket = new WebSocket(`ws://${window.location.host}/ws`);

         socket.onopen = () => {
           setIsConnected(true);
           socket.send(JSON.stringify({ type: "subscribe", sheetId }));
         };

         socket.onmessage = (event) => {
           const data = JSON.parse(event.data);
           if (data.type === "sheet_update") {
             eventBus.publish(EventTypes.SHEET_DATA_UPDATED, data.payload);
           }
         };

         socket.onclose = () => {
           setIsConnected(false);
           // Reconnect after a delay
           setTimeout(connectWebSocket, 3000);
         };

         socket.onerror = (error) => {
           console.error("WebSocket error:", error);
           socket.close();
         };

         socketRef.current = socket;
       };

       connectWebSocket();

       return () => {
         if (socketRef.current) {
           socketRef.current.close();
         }
       };
     }, [sheetId]);

     return { isConnected };
   };
   ```

## Medium Priority Tasks

### 6. Enhance Error Handling and User Feedback

**Tasks:**

1. **Implement Comprehensive Error Boundaries**

   - Add error boundaries at appropriate levels in the component tree
   - Ensure proper error reporting
   - Implement graceful degradation for component failures

   ```typescript
   // In client/src/components/ui/error-boundary.tsx
   import React, { Component, ErrorInfo, ReactNode } from "react";

   interface Props {
     children: ReactNode;
     fallback?: ReactNode;
   }

   interface State {
     hasError: boolean;
     error: Error | null;
   }

   export class ErrorBoundary extends Component<Props, State> {
     state: State = {
       hasError: false,
       error: null,
     };

     static getDerivedStateFromError(error: Error): State {
       return { hasError: true, error };
     }

     componentDidCatch(error: Error, errorInfo: ErrorInfo) {
       console.error("Error caught by boundary:", error, errorInfo);
       // Log to error reporting service
     }

     render() {
       if (this.state.hasError) {
         if (this.props.fallback) {
           return this.props.fallback;
         }

         return (
           <div className="error-container">
             <h2>Something went wrong</h2>
             <p>
               Please try refreshing the page or contact support if the issue
               persists.
             </p>
             <details>
               <summary>Error details</summary>
               <pre>{this.state.error?.toString()}</pre>
             </details>
           </div>
         );
       }

       return this.props.children;
     }
   }
   ```

2. **Add Loading States and Progress Indicators**

   - Implement loading states for long-running operations
   - Add progress indicators for data loading
   - Create skeleton screens for initial loading

3. **Improve Error Messaging**
   - Enhance error messages for better user understanding
   - Create a notification system for important events
   - Add contextual help for error resolution

### 7. Optimize Performance

**Tasks:**

1. **Implement Data Caching**

   - Add caching for sheet data to reduce API calls
   - Implement cache invalidation strategies
   - Use local storage for persistent caching

2. **Optimize Rendering Performance**

   - Implement virtualization for large data sets
   - Use memoization for expensive calculations
   - Optimize component re-renders

3. **Add Request Batching**
   - Batch API requests to reduce network overhead
   - Implement debouncing for frequent updates
   - Add request prioritization for critical operations

## Testing and Documentation

### 8. Comprehensive Testing

**Tasks:**

1. **Unit Testing**

   - Add unit tests for critical components
   - Test error handling and edge cases
   - Ensure proper test coverage

2. **Integration Testing**

   - Test component interactions
   - Verify data flow between components
   - Test WebSocket communication

3. **End-to-End Testing**
   - Create end-to-end tests for critical user flows
   - Test authentication and session management
   - Verify data persistence and synchronization

### 9. Documentation

**Tasks:**

1. **User Documentation**

   - Create user guides for common operations
   - Add tooltips and contextual help
   - Create a FAQ section

2. **Developer Documentation**

   - Document the architecture and component structure
   - Add code comments for complex logic
   - Create API documentation

3. **Deployment Documentation**
   - Document deployment process
   - Add environment configuration guide
   - Create troubleshooting guide

## Implementation Timeline

### Week 1: Critical Fixes

- Day 1-2: Fix Azure OpenAI API Configuration
- Day 3-4: Address React Hooks Issues
- Day 5: Fix LLM Context and System Prompt

### Week 2: Stability Improvements

- Day 1-2: Enhance Session Management
- Day 3-4: Improve Component Integration
- Day 5: Enhance Error Handling and User Feedback

### Week 3: Testing and Finalization

- Day 1-2: Comprehensive Testing
- Day 3: Performance Optimization
- Day 4-5: Documentation and Final Testing

## Conclusion

This implementation plan addresses the critical issues identified in the architectural assessment and provides a clear path forward for achieving a stable initial release of the ChatSheetAI application. By focusing on the most critical issues first and then moving on to stability improvements and performance optimizations, we can ensure a reliable application that meets user needs.

The most immediate priority is to fix the Azure OpenAI API configuration issue and address the React hooks issues, as these are preventing the core functionality from working correctly. Once these are resolved, we can enhance the LLM context and system prompt to improve the AI assistant's capabilities, followed by improvements to session management and component integration.
