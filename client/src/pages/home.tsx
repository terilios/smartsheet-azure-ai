import { Split } from "@geoffcox/react-splitter";
import ChatInterface from "../components/chat/chat-interface";
import SmartsheetFrame from "../components/smartsheet/smartsheet-frame";
import { useState, useEffect, Suspense } from "react";
import { ErrorBoundary } from "../components/ui/error-boundary";
import { LoadingState } from "../components/ui/loading-state";
import { useNotification } from "../components/ui/notification";
import { EventType, eventBus } from "@/lib/events";

export default function Home() {
  const [hasSplitError, setHasSplitError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { warning } = useNotification();

  // Handle initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500); // Short delay to prevent flash
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Add error event listener to window
    const handleError = (event: ErrorEvent) => {
      console.error('Error caught:', event.error);
      if (event.error?.toString().includes('@geoffcox/react-splitter')) {
        setHasSplitError(true);
        warning(
          "Layout Error",
          "There was an issue with the split layout. Falling back to standard layout."
        );
      }
    };

    window.addEventListener('error', handleError);
    
    // Subscribe to error events from the event bus
    const unsubscribe = eventBus.subscribe(EventType.ERROR_OCCURRED, (payload) => {
      console.error('Error from event bus:', payload.data);
    });
    
    return () => {
      window.removeEventListener('error', handleError);
      unsubscribe();
    };
  }, [warning]);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <LoadingState message="Loading application..." size="lg" />
      </div>
    );
  }

  if (hasSplitError) {
    return (
      <div className="h-screen w-full flex">
        <div className="w-[400px] h-full overflow-auto bg-background p-4">
          <ErrorBoundary componentName="ChatInterface">
            <ChatInterface />
          </ErrorBoundary>
        </div>
        <div className="flex-1 h-full overflow-auto bg-background">
          <ErrorBoundary componentName="SmartsheetFrame">
            <SmartsheetFrame />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  // Use an error boundary instead of try/catch for React components
  return (
    <div className="h-screen w-full">
      <ErrorBoundary
        onError={() => setHasSplitError(true)}
        componentName="SplitLayout"
      >
        <Split initialPrimarySize="400px" minPrimarySize="250px" minSecondarySize="30%" splitterSize="4px">
          <div className="h-full overflow-auto bg-background p-4">
            <ErrorBoundary componentName="ChatInterface">
              <Suspense fallback={<LoadingState message="Loading chat..." />}>
                <ChatInterface />
              </Suspense>
            </ErrorBoundary>
          </div>
          <div className="h-full overflow-auto bg-background">
            <ErrorBoundary componentName="SmartsheetFrame">
              <Suspense fallback={<LoadingState message="Loading sheet..." />}>
                <SmartsheetFrame />
              </Suspense>
            </ErrorBoundary>
          </div>
        </Split>
      </ErrorBoundary>
    </div>
  );
}
