import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { type Message } from "@shared/schema";
import { Loader2 } from "lucide-react";
import SheetViewer from "./sheet-viewer";

export default function SmartsheetFrame() {
  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  // Find the most recent successful sheet open message
  const sheetData = messages?.reverse().find(
    (msg) => 
      msg.role === "assistant" && 
      msg.metadata?.sheetData
  )?.metadata?.sheetData;

  if (messagesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!sheetData) {
    return (
      <Card className="m-4">
        <CardContent className="pt-6">
          <p className="text-lg font-medium">No Smartsheet Loaded</p>
          <p className="text-sm text-muted-foreground mt-2">
            Use the chat interface to open a Smartsheet by typing "open smartsheet" followed by your sheet ID.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full p-4">
      <SheetViewer data={sheetData} />
    </div>
  );
}