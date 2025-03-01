import { Component, ErrorInfo, ReactNode, useState } from "react";
import { Button } from "./button";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { EventType, eventBus } from "@/lib/events";

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  fallback?: ReactNode;
  resetKeys?: any[];
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Update state with error info
    this.setState({ errorInfo });
    
    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Publish error event
    eventBus.publish(EventType.ERROR_OCCURRED, {
      message: error.message,
      stack: error.stack,
      componentName: this.props.componentName || 'Unknown',
      timestamp: new Date().toISOString()
    });
  }
  
  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state if resetKeys change
    if (this.props.resetKeys &&
        prevProps.resetKeys &&
        this.props.resetKeys.some((key, i) => key !== prevProps.resetKeys?.[i])) {
      if (this.state.hasError) {
        this.setState({ hasError: false, error: null, errorInfo: null });
      }
    }
  }
  
  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 border border-red-200 rounded-md bg-red-50">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              An error occurred in the {this.props.componentName || 'application'}.
            </AlertDescription>
          </Alert>
          
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-1">Error details:</h3>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
              {this.state.error?.toString()}
            </pre>
          </div>
          
          {this.state.errorInfo && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-1">Component stack:</h3>
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}
          
          <div className="flex justify-end">
            <Button
              onClick={this.handleReset}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-3 w-3" />
              Try again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * A hook to create a component that can be used as a fallback for ErrorBoundary
 */
export function useErrorFallback(title: string, description?: string) {
  const [isRetrying, setIsRetrying] = useState(false);
  
  const handleRetry = () => {
    setIsRetrying(true);
    // Simulate retry delay
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };
  
  return (
    <div className="p-4 border border-red-200 rounded-md bg-red-50">
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          {description || "Please try refreshing the page or contact support if the issue persists."}
        </AlertDescription>
      </Alert>
      
      <div className="flex justify-end">
        <Button
          onClick={handleRetry}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          disabled={isRetrying}
        >
          <RefreshCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
          {isRetrying ? 'Retrying...' : 'Refresh page'}
        </Button>
      </div>
    </div>
  );
}