import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MessageList from "./message-list";
import MessageInput from "./message-input";
import SheetIdForm from "../smartsheet/sheet-id-form";
import { type Message } from "@shared/schema";
import { useState } from "react";

export default function ChatInterface() {
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
  };

  if (!hasSheetId) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <h2 className="text-lg font-semibold mb-4">Welcome to ChatSheetAI</h2>
        <SheetIdForm onSubmit={handleSheetIdSubmit} disabled={isPending} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b pb-4 mb-4">
        <h1 className="text-2xl font-semibold px-4 pt-4 mb-2">ChatSheetAI Assistant</h1>
        <div className="flex justify-between items-center px-4">
          <p className="text-sm text-gray-600">How can I help you with Smartsheet today?</p>
          <button 
            onClick={() => clearMessages()} 
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            New Chat
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-4">
        <MessageList messages={messages || []} isLoading={isLoading} />
      </div>
      <div className="border-t mt-4 px-4 py-4">
        <MessageInput onSend={sendMessage} disabled={isPending} />
      </div>
    </div>
  );
}