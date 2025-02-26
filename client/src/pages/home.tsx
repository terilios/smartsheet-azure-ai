import { Split } from "@geoffcox/react-splitter";
import ChatInterface from "../components/chat/chat-interface";
import SmartsheetFrame from "../components/smartsheet/smartsheet-frame";
import { useState, useEffect } from "react";
import { ErrorBoundary } from "../components/ui/error-boundary";

export default function Home() {
  const [hasSplitError, setHasSplitError] = useState(false);

  useEffect(() => {
    // Add error event listener to window
    const handleError = (event: ErrorEvent) => {
      console.error('Error caught:', event.error);
      if (event.error?.toString().includes('@geoffcox/react-splitter')) {
        setHasSplitError(true);
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasSplitError) {
    return (
      <div className="h-screen w-full flex">
        <div className="w-[400px] h-full overflow-auto bg-background p-4">
          <ChatInterface />
        </div>
        <div className="flex-1 h-full overflow-auto bg-background">
          <SmartsheetFrame />
        </div>
      </div>
    );
  }

  // Use an error boundary instead of try/catch for React components
  return (
    <div className="h-screen w-full">
      <ErrorBoundary onError={() => setHasSplitError(true)}>
        <Split initialPrimarySize="400px" minPrimarySize="250px" minSecondarySize="30%">
          <div className="h-full overflow-auto bg-background p-4">
            <ChatInterface />
          </div>
          <div className="h-full overflow-auto bg-background">
            <SmartsheetFrame />
          </div>
        </Split>
      </ErrorBoundary>
    </div>
  );
}
