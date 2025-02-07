import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { type Message } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export default function SmartsheetFrame() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  // Find the last sheet ID from assistant messages
  const lastSheetId = messages
    ?.filter(m => m.role === "assistant" && m.metadata?.sheetId)
    .pop()?.metadata?.sheetId;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="w-full h-full relative">
        <div className="absolute top-0 left-0 right-0 z-10 bg-background p-4">
          <p className="text-muted-foreground mb-2">
            Please log in to Smartsheet first
          </p>
          <button
            onClick={() => setIsLoggedIn(true)}
            className="text-sm text-primary hover:underline"
          >
            I'm logged in
          </button>
        </div>
        <iframe
          src="https://www.smartsheet.com/b/sign-in"
          className="absolute inset-0 w-full h-full border-0"
          title="Smartsheet Login"
        />
      </div>
    );
  }

  if (!lastSheetId) {
    return (
      <Card className="m-4 p-4">
        <p className="text-muted-foreground">
          Use the chat interface to enter your Smartsheet ID
        </p>
      </Card>
    );
  }

  return (
    <div className="w-full h-full relative">
      <iframe
        src={`https://app.smartsheet.com/sheets/${lastSheetId}`}
        className="absolute inset-0 w-full h-full border-0"
        title="Smartsheet"
        allow="fullscreen"
      />
    </div>
  );
}