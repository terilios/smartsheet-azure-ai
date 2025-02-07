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
    <div className="space-y-4">
      {messages.map((message) => (
        <Card key={message.id} className="p-4">
          <div className="flex items-start gap-2">
            <div className="font-semibold">
              {message.role === "user" ? "You" : "Assistant"}:
            </div>
            <div className="flex-1">{message.content}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}
