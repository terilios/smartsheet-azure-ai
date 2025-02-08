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
      <div className="flex-1 overflow-auto">
        <MessageList messages={messages || []} isLoading={isLoading} />
      </div>
      <MessageInput onSend={sendMessage} disabled={isPending} />
    </div>
  );
}