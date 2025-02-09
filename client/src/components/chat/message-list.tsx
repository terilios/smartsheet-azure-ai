import { type Message } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="space-y-4 mb-4">
      {messages.filter(message => message.role !== 'system').map((message, i) => (
        <div
          key={i}
          className={cn(
            "flex gap-3 p-4 rounded-lg",
            message.role === "assistant" ? "bg-muted/50" : "bg-background"
          )}
        >
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-white",
              message.role === "assistant" ? "bg-blue-500" : "bg-slate-500"
            )}
          >
            {message.role === "assistant" ? "A" : "U"}
          </div>
          <div className="flex-1 space-y-2">
            <div className="prose dark:prose-invert max-w-none">
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
            {message.metadata?.status === "error" && message.metadata.error && (
              <div className="text-destructive text-sm">
                Error: {message.metadata.error}
              </div>
            )}
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
    </div>
  );
}
