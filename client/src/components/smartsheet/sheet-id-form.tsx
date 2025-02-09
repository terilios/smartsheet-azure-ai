import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface SheetIdFormProps {
  onSubmit: (sheetId: string) => void;
  error?: string;
  isLoading?: boolean;
}

export default function SheetIdForm({ onSubmit, error, isLoading }: SheetIdFormProps) {
  const [sheetId, setSheetId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sheetId.trim()) {
      onSubmit(sheetId.trim());
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Enter Smartsheet ID</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Enter your Smartsheet ID..."
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
              disabled={isLoading}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={!sheetId.trim() || isLoading}>
            {isLoading ? "Loading..." : "Load Sheet"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
