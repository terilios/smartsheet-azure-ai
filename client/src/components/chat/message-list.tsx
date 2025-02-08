import { type Message } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {messages.map((message) => (
        <div key={message.id} className="flex items-start gap-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            message.role === "user" ? "bg-gray-200" : "bg-blue-100"
          }`}>
            {message.role === "user" ? "U" : "A"}
          </div>
          <div className="flex-1">
            <div className="font-medium mb-1">
              {message.role === "user" ? "You" : "Assistant"}
            </div>
            <div className="text-gray-700">{message.content}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
