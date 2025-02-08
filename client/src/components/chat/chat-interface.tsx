import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MessageList from "./message-list";
import MessageInput from "./message-input";
import SheetIdForm from "../smartsheet/sheet-id-form";
import { type Message } from "@shared/schema";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { format } from "date-fns";

export default function ChatInterface() {
  const [view, setView] = useState<'welcome' | 'chat'>('welcome');
  const [hasSheetId, setHasSheetId] = useState(false);

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  const { mutate: clearMessages } = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/messages");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      setView('welcome');
      setHasSheetId(false);
    },
  });

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/messages", {
        content,
        role: "user",
        metadata: null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  const handleSheetIdSubmit = (sheetId: string) => {
    sendMessage(`open smartsheet ${sheetId}`);
    setHasSheetId(true);
    setView('chat');
  };

  if (view === 'welcome') {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <h2 className="text-2xl font-semibold mb-6">Welcome to ChatSheetAI</h2>
        {messages && messages.length > 0 ? (
          <div className="space-y-4 mb-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Recent Chats</h3>
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
                  const key = format(date, 'PP'); // Format date as "Apr 29, 2021"
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(message);
                  return groups;
                }, {})).map(([date, messages]) => (
                  <div 
                    key={date} 
                    className="p-4 hover:bg-accent/50 cursor-pointer transition-colors" 
                    onClick={() => setView('chat')}
                  >
                    <div className="text-sm text-muted-foreground mb-1">{date}</div>
                    <div className="text-sm line-clamp-2">{messages[0].content}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <SheetIdForm onSubmit={handleSheetIdSubmit} disabled={isPending} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
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
        {!hasSheetId && (
          <div className="px-4 mt-4">
            <SheetIdForm onSubmit={handleSheetIdSubmit} disabled={isPending} />
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto px-4">
        {messages?.length === 0 && hasSheetId && (
          <div className="text-muted-foreground text-sm mb-4">
            You can ask questions about your Smartsheet or request specific actions. Try "What's in this sheet?" to get started.
          </div>
        )}
        <MessageList messages={messages || []} isLoading={isLoading} />
      </div>
      <div className="border-t mt-4 px-4 py-4">
        <MessageInput onSend={sendMessage} disabled={isPending || !hasSheetId} />
      </div>
    </div>
  );
}