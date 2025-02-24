```mermaid
sequenceDiagram
    participant User
    participant ChatUI
    participant SmartsheetFrame
    participant LLM
    participant Server
    participant SmartsheetAPI
    participant Storage

    %% Initial Page Load
    User->>ChatUI: Load Application
    ChatUI->>Server: GET /api/messages
    Server->>Storage: Get chat history
    Storage-->>ChatUI: Return messages
    ChatUI->>SmartsheetFrame: Initialize viewer
    SmartsheetFrame->>SmartsheetFrame: Check for existing sheetId<br/>in messages

    %% Sheet ID Input Flow
    User->>ChatUI: Enter "open sheet {id}"
    ChatUI->>Server: POST /api/messages
    Server->>LLM: Send chat history + command
    LLM->>Server: Call openSheet function
    Server->>SmartsheetAPI: Validate sheet access
    SmartsheetAPI-->>Server: Return basic info
    
    rect rgb(200, 255, 200)
        Note over Server,Storage: Metadata Only Flow
        Server->>Storage: Save minimal metadata:<br/>sheetId, name, columns
        Storage-->>ChatUI: Update messages
        ChatUI->>SmartsheetFrame: Sheet ID available
    end

    rect rgb(200, 200, 255)
        Note over SmartsheetFrame,SmartsheetAPI: Data Flow
        SmartsheetFrame->>Server: GET /api/smartsheet?sheetId={id}
        Server->>SmartsheetAPI: Get full sheet data
        SmartsheetAPI-->>Server: Return complete data
        Server-->>SmartsheetFrame: Return sheet data
        SmartsheetFrame->>SmartsheetFrame: Render sheet view
    end

    %% User Operations Flow
    User->>ChatUI: Request operation<br/>for example: add column
    ChatUI->>Server: POST /api/messages
    Server->>LLM: Process request
    LLM->>Server: Call appropriate function
    Server->>SmartsheetAPI: Execute operation
    SmartsheetAPI-->>Server: Return result
    
    rect rgb(255, 200, 200)
        Note over Server,SmartsheetFrame: Update Flow
        Server->>Storage: Save operation result
        Storage-->>ChatUI: Update messages
        SmartsheetFrame->>Server: Refetch sheet data
        Server->>SmartsheetAPI: Get updated data
        SmartsheetAPI-->>SmartsheetFrame: Return new data
        SmartsheetFrame->>SmartsheetFrame: Re-render view
    end

    Note over User,SmartsheetFrame: Key Features:
    Note over User,SmartsheetFrame: 1. LLM never sees full sheet data
    Note over User,SmartsheetFrame: 2. Separate data and command paths
    Note over User,SmartsheetFrame: 3. Real-time viewer updates
    Note over User,SmartsheetFrame: 4. Clean metadata separation
```



```mermaid
sequenceDiagram
    participant User
    participant UI
    participant SheetViewer
    participant LLM
    participant Server
    participant SmartsheetAPI

    %% Initial Sheet Load - Direct Path
    rect rgb(200, 255, 200)
        Note over User,SmartsheetAPI: Direct Sheet Loading
        User->>UI: Enter Sheet ID
        UI->>Server: GET /api/smartsheet?sheetId={id}
        Server->>SmartsheetAPI: Fetch full sheet data
        SmartsheetAPI-->>Server: Return complete data
        Server-->>SheetViewer: Stream full dataset
        SheetViewer->>SheetViewer: Render complete view
    end

    %% Separate Chat/LLM Flow
    rect rgb(200, 200, 255)
        Note over User,LLM: Independent Chat Operations
        User->>UI: Start chat interaction
        UI->>Server: POST /api/messages
        Server->>LLM: Process command
        
        Note over LLM,SmartsheetAPI: LLM Operations
        LLM->>Server: Request sheet info
        Server->>SmartsheetAPI: Get sheet metadata
        SmartsheetAPI-->>Server: Return minimal info
        Server-->>LLM: Sheet structure only
        
        LLM->>Server: Execute operation
        Server->>SmartsheetAPI: Perform action
        SmartsheetAPI-->>Server: Confirm change
    end

    %% View Updates
    rect rgb(255, 200, 200)
        Note over SheetViewer,SmartsheetAPI: Auto-Refresh
        SheetViewer->>Server: Refetch data
        Server->>SmartsheetAPI: Get updated sheet
        SmartsheetAPI-->>SheetViewer: Return new data
        SheetViewer->>SheetViewer: Update view
    end

    Note over User,SmartsheetAPI: Key Improvements:
    Note over User,SmartsheetAPI: 1. Sheet loads immediately without LLM
    Note over User,SmartsheetAPI: 2. Full dataset in viewer only
    Note over User,SmartsheetAPI: 3. LLM gets metadata when needed
    Note over User,SmartsheetAPI: 4. Clean separation of data and operations
```

```mermaid
sequenceDiagram
    participant User
    participant LLM
    participant BatchProcessor
    participant Sheet

    User->>LLM: Natural language request
    Note over LLM: Understand task requirements
    
    LLM->>BatchProcessor: Create processing task
    Note over BatchProcessor: Extract:
    Note over BatchProcessor: - Source columns
    Note over BatchProcessor: - Target column
    Note over BatchProcessor: - Processing intent
    Note over BatchProcessor: - Output format

    loop For each batch
        BatchProcessor->>Sheet: Get row data
        Sheet-->>BatchProcessor: Column values
        
        BatchProcessor->>LLM: Process with context
        Note over LLM: Dynamic prompt based on:
        Note over LLM: 1. Users original intent
        Note over LLM: 2. Current row values
        Note over LLM: 3. Required output format
        
        LLM-->>BatchProcessor: Structured result
        BatchProcessor->>Sheet: Update target column
    end
```

```mermaid
sequenceDiagram
    participant User
    participant ChatLLM
    participant JobQueue
    participant BulkProcessor
    participant ProcessingLLM
    participant Sheet

    %% Initial Task Setup
    User->>ChatLLM: Request column processing
    
    rect rgb(200, 255, 200)
        Note over ChatLLM: Task Understanding Phase
        ChatLLM->>ChatLLM: Analyze request
        ChatLLM->>ChatLLM: Generate processing prompt
        ChatLLM->>JobQueue: Create processing job
        ChatLLM->>User: Confirm job creation
    end

    %% Async Processing
    rect rgb(200, 200, 255)
        JobQueue->>BulkProcessor: Start background job
        
        loop Process Batches
            BulkProcessor->>Sheet: Get batch rows
            Sheet-->>BulkProcessor: Row data
            
            loop Each Row
                BulkProcessor->>ProcessingLLM: Apply generated prompt
                ProcessingLLM-->>BulkProcessor: Process result
            end
            
            BulkProcessor->>Sheet: Update batch
            BulkProcessor->>JobQueue: Update progress
        end
        
        JobQueue->>User: Notify completion
        
```

```mermaid
sequenceDiagram
    participant User
    participant ChatServer as Chat Server
    participant SmartsheetAPI as Smartsheet API
    participant OpenAIAPI as OpenAI API

    User->>ChatServer: POST /api/chat message, session_id
alt Session ID not provided or new
    ChatServer->>ChatServer: Create new session generate session_id
end
    ChatServer->>ChatServer: Append user message to session history
    Note over ChatServer: Determine intent: for example, data query or update
opt If data needed from Smartsheet
    ChatServer->>SmartsheetAPI: Request relevant data<br/>for example, fetch sheet or row
    SmartsheetAPI-->>ChatServer: Return requested data
end
opt If user requested an update
    ChatServer->>SmartsheetAPI: Send update for example, modify a row
    SmartsheetAPI-->>ChatServer: Return update result success/fail
end
    ChatServer->>OpenAIAPI: Submit chat prompt context + user query + data
    OpenAIAPI-->>ChatServer: Respond with AI-generated reply
    ChatServer->>ChatServer: Append AI reply to session history
    ChatServer-->>User: Return response JSON session_id, reply text
```


```mermaid
flowchart TD
    A[Start] --> B[User sends message to server]
    B --> C{Session exists?}
    C -- No --> D[Create new session<br/>and ID]
    C -- Yes --> E[Load session context]
    E --> F{Needs Smartsheet data?}
    D --> F
    F -- Yes --> G[Fetch required data<br/>from Smartsheet]
    G --> H[Data retrieved or none found]
    F -- No --> H
    H --> I[Any update action?]
    I -- Yes --> J[Execute update<br/>via Smartsheet API]
    J --> K[Update success or failure noted]	
    I -- No --> K
    K --> L[Assemble OpenAI prompt<br/>context, data, query]
    L --> M[Call OpenAI ChatCompletion API]
    M --> N[Receive AI response]
    N --> O[Format response to user]
    O --> P[Send response back to user]
    P --> Q[End]

```


```mermaid
flowchart TD
  %% Client Request Flow
  A[Client Request: GET /api/smartsheet/:sheetId] --> B[Express Router /api/smartsheet/:sheetId]
  B --> C[SmartsheetTools.getSheetData]
  C --> D[Call External Smartsheet API<br/>GET https://api.smartsheet.com/2.0/sheets/sheetId]
  D --> E[Receive Sheet Data]
  E --> F[transformSheetData<br/>Extract columns & rows]
  F --> G[Cache Data in sheetCache]
  G --> H[Return Processed Data to Router]
  H --> I[Express Responds with Sheet Data]

  %% Chat Message Flow
  J[Client Request: POST /api/messages<br/>with message & sessionId] --> K[Express Router /api/messages]
  K --> L[storage.addMessage sessionId, message]
  L --> M[DB Operation: Insert into messages table]
  M --> N[Foreign Key Check & Constraint<br/>session_id must exist in sessions/chat_sessions]
  N --> O[Update sessions.updatedAt]
  O --> P[Message Successfully Stored]
  P --> Q[Return Confirmation to Client]
  
  %% Database Schema
  subgraph DB [Database]
    S[(sessions / chat_sessions)]
    T[(messages)]
    T -- "FK: session_id references" --> S
  end

  %% Linking Chat Flow with DB
  L --- S
  
  %% Notes
  R[Note: The sessions table is expected to hold valid session identifiers.
  The error violates foreign key constraint indicates that the session_id used while inserting into the messages table does not exist in the sessions table.
  A dummy or properly created session id must be used until authentication or session configuration is completed.]
  
  Q --- R
```

