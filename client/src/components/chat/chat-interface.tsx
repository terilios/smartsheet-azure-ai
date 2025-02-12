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

export default function ChatInterface() {
  const [view, setView] = useState<'welcome' | 'chat'>('welcome');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const { currentSheetId, currentSessionId, setCurrentSessionId, clearSession } = useSmartsheet();
  const { toast } = useToast();

  // Reset view when session changes
  useEffect(() => {
    if (!currentSessionId) {
      setView('welcome');
    }
  }, [currentSessionId]);

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/messages", currentSessionId],
    queryFn: async () => {
      if (!currentSessionId) return [];
      try {
        // First verify session exists
        const sessionRes = await apiRequest("GET", `/api/sessions/${currentSessionId}`);
        if (!sessionRes.ok) {
          // Session doesn't exist, try to recreate it
          if (currentSheetId) {
            const createRes = await apiRequest("POST", "/api/sessions", {
              sheetId: currentSheetId
            });
            if (createRes.ok) {
              const { sessionId } = await createRes.json();
              setCurrentSessionId(sessionId);
              // Now try to get messages with new session
              const newMsgRes = await apiRequest("GET", `/api/messages?sessionId=${sessionId}`);
              if (newMsgRes.ok) {
                const allMessages = await newMsgRes.json();
                return filterAndDeduplicateMessages(allMessages);
              }
            }
          }
          // If recreation failed or no sheet ID, clear session
          clearSession();
          return [];
        }

        const res = await apiRequest("GET", `/api/messages?sessionId=${currentSessionId}`);
        if (!res.ok) {
          throw new Error('Failed to fetch messages');
        }
        const allMessages = await res.json();
        return filterAndDeduplicateMessages(allMessages);
      } catch (error) {
        console.error("Failed to fetch messages:", error);
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
          msg.timestamp === curr.timestamp && 
          msg.content === curr.content
        );
        if (!exists) acc.push(curr);
        return acc;
      }, []);
  };

  const { mutate: clearMessages, isPending: isClearing } = useMutation({
    mutationFn: async () => {
      if (!currentSessionId || !currentSheetId) return;
      try {
        // First verify session exists
        const sessionRes = await apiRequest("GET", `/api/sessions/${currentSessionId}`);
        if (!sessionRes.ok) {
          // Session doesn't exist, try to recreate it
          const createRes = await apiRequest("POST", "/api/sessions", {
            sheetId: currentSheetId
          });
          if (!createRes.ok) {
            throw new Error('Failed to recreate session');
          }
          const { sessionId } = await createRes.json();
          setCurrentSessionId(sessionId);
        }

        // Now try to clear messages
        const res = await apiRequest("DELETE", `/api/messages?sessionId=${currentSessionId}`);
        if (!res.ok) {
          throw new Error('Failed to clear messages');
        }
        clearSession();
      } catch (error) {
        console.error("Failed to clear messages:", error);
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
      if (!currentSessionId || !currentSheetId) {
        throw new Error("No active session or sheet");
      }

      try {
        // First verify session exists
        const sessionRes = await apiRequest("GET", `/api/sessions/${currentSessionId}`);
        if (!sessionRes.ok) {
          // Session doesn't exist, try to recreate it
          const createRes = await apiRequest("POST", "/api/sessions", {
            sheetId: currentSheetId
          });
          if (!createRes.ok) {
            throw new Error('Failed to recreate session');
          }
          const { sessionId } = await createRes.json();
          setCurrentSessionId(sessionId);
        }

        // Now try to send message
        const res = await apiRequest("POST", "/api/messages", {
          content,
          role: "user",
          metadata: {
            sessionId: currentSessionId,
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

  // Show welcome view only if there are no messages
  const hasMessages = messages && messages.length > 0;
  const showWelcome = view === 'welcome' && hasMessages;

  if (showWelcome) {
    return (
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
                {Object.entries(messages.reduce<Record<string, Message[]>>((groups, message) => {
                  const date = new Date(message.timestamp || Date.now());
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
  }

  return (
    <div className="flex flex-col h-full">
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
}
