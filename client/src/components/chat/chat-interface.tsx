import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MessageList from "./message-list";
import MessageInput from "./message-input";
import { type Message } from "@shared/schema";

export default function ChatInterface() {
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <MessageList messages={messages || []} isLoading={isLoading} />
      </div>
      <MessageInput onSend={sendMessage} disabled={isPending} />
    </div>
  );
}