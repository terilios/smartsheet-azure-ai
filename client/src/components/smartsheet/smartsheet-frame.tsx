import React, { useEffect, useState, useRef } from "react";
import { useSessionValidator } from "@/lib/session-validator";
import { useSmartsheet } from "@/lib/smartsheet-context";
import { useToast } from "@/hooks/use-toast";
import SheetViewer from "@/components/smartsheet/sheet-viewer";
import { type SheetError } from "@/lib/types";

const SmartsheetFrame = () => {
  const { currentSessionId, setCurrentSessionId } = useSmartsheet();
  const { toast } = useToast();
  const { validateSession, recreateSession } = useSessionValidator();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const sessionAttemptedRef = useRef<boolean>(false);

  useEffect(() => {
    async function ensureSession() {
      // Prevent infinite loop by only attempting to create a session once
      if (sessionAttemptedRef.current) {
        setLoading(false);
        return;
      }
      
      sessionAttemptedRef.current = true;
      
      try {
        // If there's no session id, validate (which will create one if missing)
        if (!currentSessionId) {
          const valid = await validateSession();
          if (!valid) {
            // Try to recreate session if not valid
            const newSession = await recreateSession();
            if (newSession) {
              setCurrentSessionId(newSession);
            } else {
              setError("Failed to create a valid session.");
            }
          }
        }
      } catch (err) {
        console.error("Error ensuring session:", err);
        setError("Error ensuring session.");
      } finally {
        setLoading(false);
      }
    }
    ensureSession();
  }, [validateSession, recreateSession, setCurrentSessionId]);

  if (loading) return <div>Loading session...</div>;
  if (error) {
    toast({
      title: "Session Error",
      description: error,
      variant: "destructive"
    });
    return <div>Error: {error}</div>;
  }

  // Get sheet data from the context
  const { sheetData, isLoading: sheetLoading, error: sheetError, refreshSheetData } = useSmartsheet();

  // Create a proper SheetError object if we have an error string
  const errorObj = error ?
    Object.assign(new Error(error), { name: 'SessionError' }) as SheetError :
    null;

  return (
    <div className="h-full">
      <SheetViewer
        data={sheetData || undefined}
        isLoading={loading || sheetLoading}
        error={sheetError || errorObj}
        onRetry={refreshSheetData}
        sessionId={currentSessionId}
      />
    </div>
  );
};

export default SmartsheetFrame;
