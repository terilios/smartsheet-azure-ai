import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface SheetIdFormProps {
  onSubmit: (sheetId: string) => void;
  error?: string;
  isLoading?: boolean;
}

export default function SheetIdForm({ onSubmit, error, isLoading }: SheetIdFormProps) {
  const [sheetId, setSheetId] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSheetId = sheetId.trim();
    console.log("SheetIdForm: Received sheetId input:", trimmedSheetId);
    if (!trimmedSheetId) {
      setLocalError("Sheet ID is required.");
      return;
    }
    const numericPattern = /^\d+$/;
    if (!numericPattern.test(trimmedSheetId)) {
      console.error("SheetIdForm: Invalid Sheet ID. Must contain only digits. Received:", trimmedSheetId);
      setLocalError("Invalid Sheet ID. Please enter only digits (e.g. 4104733329411972).");
      return;
    }
    setLocalError("");
    console.log("SheetIdForm: Validated Sheet ID:", trimmedSheetId);
    onSubmit(trimmedSheetId);
  };

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Enter Smartsheet ID</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            type="text"
            placeholder="Enter your Smartsheet ID..."
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
            disabled={isLoading}
            className="w-full"
          />
          <p className="text-sm text-muted-foreground mt-2">
            You can find the Sheet ID in the URL when viewing your sheet:
            https://app.smartsheet.com/sheets/<span className="font-mono">SHEET_ID</span>
          </p>
        </div>
        {(error || localError) && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{localError || error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={!sheetId.trim() || isLoading}>
          {isLoading ? "Loading..." : "Load Sheet"}
        </Button>
      </form>
    </div>
  );
}
