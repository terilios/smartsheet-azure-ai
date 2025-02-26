import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useSmartsheet } from '@/lib/smartsheet-context';
import { useToast } from '@/hooks/use-toast';

interface FullscreenSheetIdModalProps {
  onComplete?: () => void;
}

export function FullscreenSheetIdModal({ onComplete }: FullscreenSheetIdModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sheetId, setSheetId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setCurrentSheetId, setCurrentSessionId, currentSheetId, clearSession } = useSmartsheet();
  const { toast } = useToast();

  // Show modal on mount if no sheet ID is set
  useEffect(() => {
    if (!currentSheetId) {
      setIsOpen(true);
    }
  }, [currentSheetId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSheetId = sheetId.trim();
    
    if (!trimmedSheetId) {
      setError("Sheet ID is required.");
      return;
    }
    
    const numericPattern = /^\d+$/;
    if (!numericPattern.test(trimmedSheetId)) {
      setError("Invalid Sheet ID. Please enter only digits (e.g. 4104733329411972).");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      // Create session first
      const sessionResponse = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sheetId: trimmedSheetId })
      });
      
      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.error || 'Failed to create session');
      }
      
      const { sessionId, success } = await sessionResponse.json();
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

      // Verify sheet access first
      const sheetVerifyResponse = await fetch(`/api/smartsheet/verify/${trimmedSheetId}`, {
        headers: {
          'x-session-id': sessionId
        }
      });
      if (!sheetVerifyResponse.ok) {
        const errorData = await sheetVerifyResponse.json();
        throw new Error(errorData.error || 'Invalid Sheet ID or unable to access sheet');
      }
      
      // Fetch sheet data
      const sheetResponse = await fetch(`/api/smartsheet/${trimmedSheetId}`, {
        headers: {
          'x-session-id': sessionId
        }
      });
      if (!sheetResponse.ok) {
        const errorData = await sheetResponse.json();
        throw new Error(errorData.error || 'Failed to load sheet data');
      }

      // Update the global context with both IDs
      setCurrentSheetId(trimmedSheetId);
      setCurrentSessionId(sessionId);
      setIsOpen(false);
      toast({
        title: "Success",
        description: "Sheet loaded successfully."
      });
      onComplete?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate sheet ID';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      clearSession();
    } finally {
      setIsLoading(false);
    }
  };

  // Prevent closing if no sheet ID is set
  const handleOpenChange = (open: boolean) => {
    if (currentSheetId || open) {
      setIsOpen(open);
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={handleOpenChange}
      modal={true}
    >
      <DialogContent className="max-w-4xl min-h-[80vh] flex flex-col items-center justify-center">
        <DialogHeader className="text-center w-full">
          <DialogTitle className="text-3xl font-semibold mb-4">Welcome to ChatSheetAI</DialogTitle>
          <div className="space-y-2">
            <p className="text-lg text-muted-foreground">
              To get started, please enter your Smartsheet ID
            </p>
            <p className="text-sm text-muted-foreground">
              This will allow ChatSheetAI to interact with your Smartsheet data
            </p>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-8 w-full max-w-xl mx-auto">
          <div className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Enter your Smartsheet ID..."
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                disabled={isLoading}
                className="w-full"
              />
              <div className="space-y-1 mt-2">
                <p className="text-sm text-muted-foreground">
                  You can find the Sheet ID in the URL when viewing your sheet:
                  https://app.smartsheet.com/sheets/<span className="font-mono">SHEET_ID</span>
                </p>
                <a 
                  href="https://help.smartsheet.com/articles/2482711-get-smartsheet-ids"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Learn more about finding your Sheet ID
                </a>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              {currentSheetId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
              )}
              <Button 
                type="submit" 
                disabled={!sheetId.trim() || isLoading}
              >
                {isLoading ? "Validating..." : "Load Sheet"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
