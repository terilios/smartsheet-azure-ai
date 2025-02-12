import { type Message } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  // Sort messages by timestamp to ensure correct order
  const sortedMessages = [...messages].sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeA - timeB;
  });

  return (
    <div className="space-y-4 mb-4">
      {sortedMessages.map((message, i) => {
        const isError = message.metadata?.status === "error";
        const isPending = message.metadata?.status === "pending";
        const isSuccess = message.metadata?.status === "success";
        const isAssistant = message.role === "assistant";
        const isUser = message.role === "user";

        return (
          <div
            key={`${message.timestamp}-${i}`}
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
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children }) {
                        const match = /language-(\w+)/.exec(className || '');
                        return match ? (
                          <SyntaxHighlighter
                            language={match[1]}
                            style={vscDarkPlus}
                            PreTag="div"
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className}>{children}</code>
                        );
                      },
                      table({ children }) {
                        return (
                          <div className="overflow-x-auto">
                            <table className="border-collapse table-auto w-full">
                              {children}
                            </table>
                          </div>
                        );
                      },
                      th({ children }) {
                        return (
                          <th className="border border-slate-600 dark:border-slate-700 p-2 text-left bg-slate-100 dark:bg-slate-800">
                            {children}
                          </th>
                        );
                      },
                      td({ children }) {
                        return (
                          <td className="border border-slate-600 dark:border-slate-700 p-2">
                            {children}
                          </td>
                        );
                      },
                      ul({ children }) {
                        return <ul className="list-disc pl-4 my-2">{children}</ul>;
                      },
                      ol({ children }) {
                        return <ol className="list-decimal pl-4 my-2">{children}</ol>;
                      },
                      blockquote({ children }) {
                        return (
                          <blockquote className="border-l-4 border-slate-300 dark:border-slate-700 pl-4 my-2 italic">
                            {children}
                          </blockquote>
                        );
                      }
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
              {isError && message.metadata?.error && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {typeof message.metadata.error === 'string' 
                      ? message.metadata.error 
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
