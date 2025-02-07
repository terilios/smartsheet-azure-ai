import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { type Message } from "@shared/schema";

export default function SmartsheetFrame() {
  const { data: messages } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  // Find the last sheet ID from assistant messages
  const lastSheetId = messages
    ?.filter(m => m.role === "assistant" && m.metadata?.sheetId)
    .pop()?.metadata?.sheetId;

  if (!lastSheetId) {
    return (
      <Card className="m-4 p-4">
        <p>Use the chat interface to select a Smartsheet to view</p>
      </Card>
    );
  }

  return (
    <iframe
      src={`https://app.smartsheet.com/sheets/${lastSheetId}`}
      className="w-full h-full border-0"
      title="Smartsheet"
    />
  );
}