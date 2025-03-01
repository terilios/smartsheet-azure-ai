import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MessageList from "./message-list";
import MessageInput from "./message-input";
import { type Message } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { JobProgress } from "@/components/ui/job-progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useSmartsheet } from "@/lib/smartsheet-context";
import { useToast } from "@/hooks/use-toast";
import { useSessionValidator } from "@/lib/session-validator";
import { EventType, eventBus } from "@/lib/events";

export default function ChatInterface() {
  const [view, setView] = useState<'welcome' | 'chat'>('welcome');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const { currentSheetId, currentSessionId, setCurrentSessionId, clearSession } = useSmartsheet();
  const { toast } = useToast();
  const { isValid, isValidating, hasSheetData, validateSession, recreateSession, recoverSession } = useSessionValidator();

  // Reset view when session changes
  useEffect(() => {
    try {
      if (!currentSessionId) {
        setView('welcome');
      }
    } catch (error) {
      console.error('Error in session effect:', error);
    }
  }, [currentSessionId]);

  // Add error boundary effect
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Error in ChatInterface:', error);
      toast({
        title: "Error",
        description: "An error occurred in the chat interface. Please try refreshing the page.",
        variant: "destructive"
      });
      
      // Publish error event
      eventBus.publish(EventType.ERROR_OCCURRED, {
        message: error.message,
        source: 'ChatInterface',
        stack: error.error?.stack
      });
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [toast]);
  
  // Validate session when component mounts
  useEffect(() => {
    if (currentSessionId && !isValidating) {
      validateSession().then(valid => {
        if (!valid && currentSheetId) {
          console.log('Session invalid, attempting to recreate...');
          recreateSession();
        } else if (valid && !hasSheetData && currentSheetId) {
          console.log('Session valid but missing sheet data, attempting to recover...');
          recoverSession();
        }
      });
    }
  }, [currentSessionId, currentSheetId, isValidating, hasSheetData, validateSession, recreateSession, recoverSession]);

  const { data: messages = [], isLoading: isLoadingMessages, error: messagesError } = useQuery<Message[]>({
    queryKey: ["/api/messages", currentSessionId, isValid],
    queryFn: async () => {
      if (!currentSessionId) return [];
      
      try {
        // Use session validator to check if session is valid and has sheet data
        const sessionValid = await validateSession();
        
        if (!sessionValid) {
          // Session doesn't exist or is invalid, try to recreate it
          if (currentSheetId) {
            const newSessionId = await recreateSession();
            
            if (newSessionId) {
              // Now try to get messages with new session
              const newMsgRes = await apiRequest("GET", `/api/messages?sessionId=${newSessionId}`);
              if (newMsgRes.ok) {
                const allMessages = await newMsgRes.json();
                
                // Publish event for new messages
                eventBus.publish(EventType.MESSAGE_RECEIVED, {
                  sessionId: newSessionId,
                  count: allMessages.length
                });
                
                return filterAndDeduplicateMessages(allMessages);
              }
            }
          }
          // If recreation failed or no sheet ID, return empty array
          return [];
        } else if (!hasSheetData && currentSheetId) {
          // Session is valid but missing sheet data, try to recover it
          console.log('Session valid but missing sheet data, attempting to recover...');
          const recovered = await recoverSession();
          
          if (!recovered) {
            console.error('Failed to recover session sheet data');
            toast({
              title: "Data Error",
              description: "Failed to load sheet data. Please try refreshing the page.",
              variant: "destructive"
            });
          }
        }

        // Session is valid, fetch messages
        const res = await apiRequest("GET", `/api/messages?sessionId=${currentSessionId}`);
        if (!res.ok) {
          throw new Error('Failed to fetch messages');
        }
        
        const allMessages = await res.json();
        
        // Publish event for received messages
        eventBus.publish(EventType.MESSAGE_RECEIVED, {
          sessionId: currentSessionId,
          count: allMessages.length
        });
        
        return filterAndDeduplicateMessages(allMessages);
      } catch (error) {
        console.error("Failed to fetch messages:", error);
        
        // Publish error event
        eventBus.publish(EventType.ERROR_OCCURRED, {
          message: error instanceof Error ? error.message : 'Unknown error fetching messages',
          source: 'ChatInterface.fetchMessages'
        });
        
        toast({
          title: "Error",
          description: "Failed to load chat messages. Please try again.",
          variant: "destructive"
        });
        
        return [];
      }
    },
    enabled: !!currentSessionId,
    staleTime: 5000, // Consider data fresh for 5 seconds
    retry: 2
  });

  // Helper function to filter and deduplicate messages
  const filterAndDeduplicateMessages = (messages: Message[]): Message[] => {
    return messages
      .filter((msg: Message) => msg.role !== 'system')
      .reduce((acc: Message[], curr: Message) => {
        const exists = acc.some(msg => 
          msg.metadata.timestamp === curr.metadata.timestamp && 
          msg.content === curr.content
        );
        if (!exists) acc.push(curr);
        return acc;
      }, []);
  };

  const { mutate: clearMessages, isPending: isClearing } = useMutation({
    mutationFn: async () => {
      if (!currentSheetId) return;
      
      try {
        // Use session validator to check if session is valid and has sheet data
        let sessionId = currentSessionId;
        const sessionValid = sessionId ? await validateSession() : false;
        
        if (!sessionValid) {
          // Session doesn't exist or is invalid, try to recreate it
          const newSessionId = await recreateSession();
          if (!newSessionId) {
            throw new Error('Failed to create a valid session');
          }
          sessionId = newSessionId;
        } else if (!hasSheetData) {
          // For clearing messages, we don't need to recover sheet data
          // Just proceed with the valid session
          console.log('Session valid but missing sheet data, proceeding with clear operation...');
        }

        // Now try to clear messages
        const res = await apiRequest("DELETE", `/api/messages?sessionId=${sessionId}`);
        if (!res.ok) {
          throw new Error('Failed to clear messages');
        }
        
        // Publish event for messages cleared
        eventBus.publish(EventType.SESSION_UPDATED, {
          sessionId,
          action: 'cleared',
          timestamp: new Date().toISOString()
        });
        
        clearSession();
      } catch (error) {
        console.error("Failed to clear messages:", error);
        
        // Publish error event
        eventBus.publish(EventType.ERROR_OCCURRED, {
          message: error instanceof Error ? error.message : 'Unknown error clearing messages',
          source: 'ChatInterface.clearMessages'
        });
        
        // If we hit any error, just clear the session and start fresh
        clearSession();
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      setView('welcome');
      toast({
        title: "Success",
        description: "Chat history cleared successfully."
      });
    },
    onError: () => {
      toast({
        title: "Session Reset",
        description: "Session has been reset. You can start a new chat.",
        variant: "default"
      });
      setView('welcome');
    }
  });

  const { mutate: sendMessage, isPending: isSending } = useMutation({
    mutationFn: async (content: string) => {
      if (!currentSheetId) {
        throw new Error("No active sheet");
      }

      try {
        // Use session validator to check if session is valid and has sheet data
        let sessionId = currentSessionId;
        const sessionValid = sessionId ? await validateSession() : false;
        
        if (!sessionValid) {
          // Session doesn't exist or is invalid, try to recreate it
          const newSessionId = await recreateSession();
          if (!newSessionId) {
            throw new Error('Failed to create a valid session');
          }
          sessionId = newSessionId;
        } else if (!hasSheetData) {
          // Session is valid but missing sheet data, try to recover it
          console.log('Session valid but missing sheet data, attempting to recover before sending message...');
          const recovered = await recoverSession();
          
          if (!recovered) {
            throw new Error('Failed to load sheet data for session');
          }
        }

        // Publish event for message being sent
        eventBus.publish(EventType.MESSAGE_SENT, {
          content,
          sessionId,
          timestamp: new Date().toISOString()
        });

        // Now try to send message
        const res = await apiRequest("POST", "/api/messages", {
          content,
          role: "user",
          metadata: {
            sessionId,
            sheetId: currentSheetId,
            operation: null,
            status: null,
            timestamp: new Date().toISOString()
          }
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to send message");
        }

        return res.json();
      } catch (error) {
        console.error("Failed to send message:", error);
        
        // Publish error event
        eventBus.publish(EventType.ERROR_OCCURRED, {
          message: error instanceof Error ? error.message : 'Unknown error sending message',
          source: 'ChatInterface.sendMessage'
        });
        
        // If we hit a session error, clear the session
        if (error instanceof Error && error.message.includes('session')) {
          clearSession();
        }
        throw error;
      }
    },
    onSuccess: (response) => {
      // Only switch to chat view after successful message send
      setView('chat');
      
      if (response.jobId) {
        setActiveJobId(response.jobId);
        
        // Publish job created event
        eventBus.publish(EventType.JOB_CREATED, {
          jobId: response.jobId,
          type: response.jobType || 'unknown',
          timestamp: new Date().toISOString()
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive"
      });
    }
  });

  // Prepare content for different views
  const hasMessages = messages && messages.length > 0;
  const showWelcome = view === 'welcome' && hasMessages;
  const hasError = !!messagesError;
  
  // Prepare welcome view content
  const welcomeViewContent = (
    <div className="h-full">
      <div className="max-w-2xl mx-auto mt-8">
        <h2 className="text-2xl font-semibold mb-6">Chat History</h2>
        <div className="space-y-4 mb-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Recent Conversations</h3>
              <Button
                variant="outline"
                onClick={() => clearMessages()}
                disabled={isClearing}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </Button>
            </div>
            <div className="divide-y border rounded-lg">
              {hasMessages && Object.entries(messages.reduce<Record<string, Message[]>>((groups, message) => {
                const date = new Date(message.metadata.timestamp || Date.now());
                const key = format(date, 'PP');
                if (!groups[key]) groups[key] = [];
                groups[key].push(message);
                return groups;
              }, {})).map(([date, msgs]) => (
                <div
                  key={date}
                  className="p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => setView('chat')}
                >
                  <div className="text-sm text-muted-foreground mb-1">{date}</div>
                  <div className="text-sm line-clamp-2">{msgs[0].content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  
  // Prepare error view content
  const errorViewContent = (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-red-600 mb-2">Failed to load messages</h2>
      <p className="text-sm text-gray-600 mb-4">{messagesError instanceof Error ? messagesError.message : 'Unknown error'}</p>
      <Button
        onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/messages"] })}
        variant="outline"
      >
        Retry
      </Button>
    </div>
  );

  // Prepare chat view content (default view)
  const chatViewContent = (
    <div className="flex flex-col h-full chat-interface" data-testid="chat-interface">
      {/* Job Progress Dialog */}
      <Dialog open={!!activeJobId} onOpenChange={() => setActiveJobId(null)}>
        <DialogContent>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Processing Sheet</h2>
            {activeJobId && (
              <JobProgress
                jobId={activeJobId}
                onComplete={() => {
                  setActiveJobId(null);
                  queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
                }}
                onError={() => {
                  setActiveJobId(null);
                  toast({
                    title: "Error",
                    description: "Failed to process sheet operation",
                    variant: "destructive"
                  });
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      <div className="border-b pb-4 mb-4">
        <div className="px-4 pt-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold">ChatSheetAI Assistant</h1>
          <Button
            variant="outline"
            onClick={() => clearMessages()}
            disabled={isClearing}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-4">
        {!hasMessages && !currentSheetId && (
          <div className="text-muted-foreground text-sm mb-4">
            Please open a Smartsheet in the viewer to get started.
          </div>
        )}
        {!hasMessages && currentSheetId && (
          <div className="text-muted-foreground text-sm mb-4">
            You can ask questions about your Smartsheet or request specific actions. Try "What's in this sheet?" to get started.
          </div>
        )}
        <MessageList
          messages={messages}
          isLoading={isLoadingMessages || isSending}
        />
      </div>
      <div className="border-t mt-4 px-4 py-4">
        <MessageInput
          onSend={sendMessage}
          disabled={isSending || isClearing || !currentSheetId}
          placeholder={currentSheetId ?
            "Type your message about the Smartsheet..." :
            "Please open a Smartsheet first..."
          }
        />
      </div>
    </div>
  );
  
  // Return the appropriate view based on state
  if (showWelcome) {
    return welcomeViewContent;
  }
  
  if (hasError) {
    return errorViewContent;
  }
  
  return chatViewContent;
}
