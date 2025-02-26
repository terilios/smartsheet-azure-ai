import { type Message } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  // Sort messages by timestamp to ensure correct order
  const sortedMessages = [...messages].sort((a, b) => {
    const timeA = new Date(a.metadata.timestamp || 0).getTime();
    const timeB = new Date(b.metadata.timestamp || 0).getTime();
    return timeA - timeB;
  });

  const getErrorMessage = (error: unknown): string => {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return 'An error occurred while processing your request';
  };

  return (
    <div className="space-y-4 mb-4 message-list">
      {sortedMessages.map((message, i) => {
        const isError = message.metadata?.status === "error";
        const isPending = message.metadata?.status === "pending";
        const isSuccess = message.metadata?.status === "success";
        const isAssistant = message.role === "assistant";
        const isUser = message.role === "user";

        return (
          <div
            key={`${message.metadata.timestamp}-${i}`}
            className={cn(
              "flex gap-3 p-4 rounded-lg transition-colors",
              isAssistant ? "bg-muted/50" : "bg-background",
              isError && "border-destructive/50 border",
              isPending && "animate-pulse"
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0",
                isAssistant ? "bg-blue-500" : "bg-slate-500",
                isError && "bg-destructive"
              )}
            >
              {isAssistant ? "A" : "U"}
            </div>
            <div className="flex-1 space-y-2 overflow-hidden">
              {isPending ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                <div className="prose dark:prose-invert max-w-none break-words">
                  {message.content && (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  )}
                </div>
              )}
              {isError && message.metadata?.error !== undefined && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {typeof message.metadata.error === 'string'
                      ? message.metadata.error
                      : message.metadata.error instanceof Error
                        ? message.metadata.error.message
                        : 'An error occurred while processing your request'}
                  </AlertDescription>
                </Alert>
              )}
              {message.metadata?.operation && (
                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                  <span>Operation: {message.metadata.operation}</span>
                  {message.metadata.status && (
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs",
                      isSuccess && "bg-green-500/10 text-green-500",
                      isPending && "bg-yellow-500/10 text-yellow-500",
                      isError && "bg-red-500/10 text-red-500"
                    )}>
                      {message.metadata.status}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {isLoading && (
        <div className="flex justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      {!isLoading && messages.length === 0 && (
        <div className="text-center text-muted-foreground p-4">
          No messages yet. Start a conversation!
        </div>
      )}
    </div>
  );
}
