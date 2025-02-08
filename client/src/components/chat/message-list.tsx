
import { type Message } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

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
      {messages.map((message, index) => (
        <div key={message.id} className="flex items-start gap-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            message.role === "user" ? "bg-primary/10" : "bg-blue-100"
          }`}>
            {message.role === "user" ? "U" : "A"}
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium">
                {message.role === "user" ? "You" : "Assistant"}
              </span>
              {index === 0 && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(), "MMM d, h:mm a")}
                </span>
              )}
            </div>
            <div className="text-gray-700 leading-relaxed">
              {message.content}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
