
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MessageList from "./message-list";
import MessageInput from "./message-input";
import SheetIdForm from "../smartsheet/sheet-id-form";
import { type Message } from "@shared/schema";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Plus } from "lucide-react";

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
      <div className="max-w-md mx-auto mt-8">
        <h2 className="text-2xl font-semibold mb-6">Welcome to ChatSheetAI</h2>
        {messages && messages.length > 0 ? (
          <div className="space-y-4 mb-6">
            <Button 
              className="w-full flex items-center gap-2" 
              onClick={() => setView('chat')}
            >
              <FileText className="w-4 h-4" />
              Continue Previous Chat
            </Button>
            <Button 
              className="w-full flex items-center gap-2"
              variant="outline"
              onClick={() => clearMessages()}
            >
              <Plus className="w-4 h-4" />
              Start New Chat
            </Button>
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
