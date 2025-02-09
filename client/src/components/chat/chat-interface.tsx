import { useState } from "react";
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

export default function ChatInterface() {
  const [view, setView] = useState<'welcome' | 'chat'>('welcome');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const { currentSheetId, currentSessionId, clearSession } = useSmartsheet();

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", currentSessionId],
    queryFn: async () => {
      if (!currentSessionId) return [];
      const res = await apiRequest("GET", `/api/messages?sessionId=${currentSessionId}`);
      const allMessages = await res.json();
      // Filter out system messages from display
      return allMessages.filter((msg: Message) => msg.role !== 'system');
    },
    enabled: !!currentSessionId
  });

  const { mutate: clearMessages } = useMutation({
    mutationFn: async () => {
      if (currentSessionId) {
        await apiRequest("DELETE", `/api/messages?sessionId=${currentSessionId}`);
      } else {
        await apiRequest("DELETE", "/api/messages");
      }
      clearSession();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      setView('welcome');
    },
  });

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/messages", {
        content,
        role: "user",
        metadata: currentSessionId ? {
          sessionId: currentSessionId,
          sheetId: currentSheetId,
          operation: null,
          status: null,
          timestamp: new Date().toISOString()
        } : null,
      });
      return res.json();
    },
    onSuccess: (response) => {
      if (response.jobId) {
        setActiveJobId(response.jobId);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  if (view === 'welcome' && messages && messages.length > 0) {
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
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-4">
        {messages?.length === 0 && !currentSheetId && (
          <div className="text-muted-foreground text-sm mb-4">
            Please open a Smartsheet in the viewer to get started.
          </div>
        )}
        {messages?.length === 0 && currentSheetId && (
          <div className="text-muted-foreground text-sm mb-4">
            You can ask questions about your Smartsheet or request specific actions. Try "What's in this sheet?" to get started.
          </div>
        )}
        <MessageList messages={messages || []} isLoading={isLoading} />
      </div>
      <div className="border-t mt-4 px-4 py-4">
        <MessageInput 
          onSend={sendMessage} 
          disabled={isPending || !currentSheetId} 
          placeholder={currentSheetId ? 
            "Type your message about the Smartsheet..." : 
            "Please open a Smartsheet first..."
          }
        />
      </div>
    </div>
  );
}
