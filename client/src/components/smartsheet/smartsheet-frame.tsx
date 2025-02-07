import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { type SmartsheetConfig } from "@shared/schema";
import ConfigForm from "./config-form";

export default function SmartsheetFrame() {
  const { data: config } = useQuery<SmartsheetConfig>({
    queryKey: ["/api/smartsheet/config"],
  });

  if (!config) {
    return (
      <div className="p-4">
        <ConfigForm />
      </div>
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