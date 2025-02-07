import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { type SmartsheetConfig } from "@shared/schema";

export default function SmartsheetFrame() {
  const { data: config } = useQuery<SmartsheetConfig>({
    queryKey: ["/api/smartsheet/config"],
  });

  if (!config) {
    return (
      <Card className="m-4 p-4">
        <p>Please configure Smartsheet integration first</p>
      </Card>
    );
  }

  return (
    <iframe
      src={`https://app.smartsheet.com/sheets/${config.sheetId}`}
      className="w-full h-full border-0"
      title="Smartsheet"
    />
  );
}
