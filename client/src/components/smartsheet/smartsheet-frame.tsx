import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type SheetData, type SheetResponse } from "@shared/schema";
import { Loader2, AlertCircle } from "lucide-react";
import SheetViewer from "./sheet-viewer";
import SheetIdForm from "./sheet-id-form";
import { BulkOperation } from "./bulk-operation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSmartsheet } from "@/lib/smartsheet-context";
import { useSheetUpdates } from "@/hooks/use-sheet-updates";
import { useToast } from "@/hooks/use-toast";

// Function to fetch full sheet data from our backend API
async function fetchSheetData(sheetId: string): Promise<SheetData> {
  try {
    const res = await fetch(`/api/smartsheet/${sheetId}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch sheet data: ${res.status}`);
    }
    const response = (await res.json()) as SheetResponse;
    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to load sheet data");
    }
    return response.data;
  } catch (err) {
    const error = err instanceof Error ? err : new Error("Failed to load sheet data");
    throw error;
  }
}

export default function SmartsheetFrame() {
  const [error, setError] = useState<string | null>(null);
  const { currentSheetId, setCurrentSheetId, setCurrentSessionId, clearSession } = useSmartsheet();
  const { toast } = useToast();

  // Set up real-time updates
  useSheetUpdates(currentSheetId);

  // Get sheet data query
  const { 
    data: sheetData, 
    isLoading,
    error: queryError,
    refetch 
  } = useQuery<SheetData, Error>({
    queryKey: ["sheetData", currentSheetId],
    queryFn: async () => {
      try {
        if (!currentSheetId) throw new Error("No sheet ID provided");
        const data = await fetchSheetData(currentSheetId);
        setError(null);
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load sheet data";
        setError(errorMessage);
        setCurrentSheetId(null);
        throw err;
      }
    },
    enabled: !!currentSheetId,
    retry: 1,
    staleTime: 30000 // Consider data fresh for 30 seconds
  });

  const handleSheetIdSubmit = async (sheetId: string) => {
    try {
      setError(null);
      
      // Create session first
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sheetId })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create session');
      }
      
      const { sessionId, success } = await response.json();
      if (!success || !sessionId) {
        throw new Error('Invalid session response');
      }

      // Verify session exists by trying to get it
      const verifyResponse = await fetch(`/api/sessions/${sessionId}`);
      if (!verifyResponse.ok) {
        throw new Error('Failed to verify session');
      }

      const sessionData = await verifyResponse.json();
      if (!sessionData || !sessionData.id) {
        throw new Error('Invalid session data');
      }

      setCurrentSessionId(sessionId);
      setCurrentSheetId(sheetId);

      toast({
        title: "Success",
        description: "Sheet loaded successfully."
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      clearSession();
    }
  };

  // Loading state
  if (currentSheetId && isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading sheet data...</p>
        </div>
      </div>
    );
  }

  // Show form if no sheet is loaded
  if (!currentSheetId) {
    return (
      <div className="p-4">
        <SheetIdForm 
          onSubmit={handleSheetIdSubmit}
          error={error || undefined}
          isLoading={isLoading}
        />
      </div>
    );
  }

  // Error state
  if (queryError || !sheetData) {
    const errorMessage = queryError instanceof Error 
      ? queryError.message 
      : "Failed to load Smartsheet data";

    return (
      <div className="p-4 space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        <SheetIdForm 
          onSubmit={handleSheetIdSubmit}
          error={error || undefined}
          isLoading={isLoading}
        />
      </div>
    );
  }

  // Show sheet data
  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {sheetData.sheetName}
        </h2>
        <div className="flex items-center gap-2">
          <BulkOperation
            sheetId={currentSheetId}
            columns={sheetData.columns}
            onComplete={() => refetch()}
          />
        </div>
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <SheetViewer data={sheetData} />
      </div>
    </div>
  );
}
