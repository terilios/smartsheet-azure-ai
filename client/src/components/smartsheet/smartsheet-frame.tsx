import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { type Message } from "@shared/schema";
import { Loader2, ExternalLink, ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SmartsheetFrame() {
  const [url, setUrl] = useState("https://www.smartsheet.com/customers-home");
  const [currentUrl, setCurrentUrl] = useState(url);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFrameBlocked, setIsFrameBlocked] = useState(false);

  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Add http:// if protocol is missing
    let urlToLoad = url;
    if (!/^https?:\/\//i.test(url)) {
      urlToLoad = `http://${url}`;
      setUrl(urlToLoad);
    }
    setCurrentUrl(urlToLoad);
    setError(null);
    setIsLoading(true);
    setIsFrameBlocked(false);
  };

  const openInNewTab = () => {
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
  };

  // Simplified navigation without trying to access iframe internals
  const handleBack = () => {
    openInNewTab();
  };

  const handleForward = () => {
    openInNewTab();
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      setError(null);
      setIsFrameBlocked(false);
      iframeRef.current.src = currentUrl;
    }
  };

  // Handle frame load errors
  const handleIframeError = () => {
    setIsLoading(false);
    setIsFrameBlocked(true);
    setError(
      "This page cannot be displayed in the embedded view. Click the external link button to open in a new tab."
    );
  };

  useEffect(() => {
    // Set up a timer to check if the frame loaded
    const timer = setTimeout(() => {
      if (isLoading) {
        setIsFrameBlocked(true);
        setError(
          "The page took too long to load or doesn't allow embedding. Click the external link button to open in a new tab."
        );
        setIsLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timer);
  }, [isLoading]);

  if (messagesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <form onSubmit={handleUrlSubmit} className="p-2 flex gap-2 border-b">
        <div className="flex gap-2">
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={handleBack}
            title="Open in new tab"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={handleForward}
            title="Open in new tab"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={handleRefresh}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
        <Input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter any URL..."
          className="flex-1"
        />
        <Button type="submit" variant="outline" size="icon">
          Go
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          size="icon"
          onClick={openInNewTab}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </form>
      <div className="flex-1 relative">
        {error ? (
          <Card className="m-4">
            <CardContent className="pt-6">
              <p className="text-destructive mb-2">{error}</p>
              <p className="text-sm text-muted-foreground">
                Many websites restrict iframe embedding for security reasons.
                Click the external link button in the toolbar to open this page in a new tab.
              </p>
              <Button
                onClick={openInNewTab}
                className="mt-4"
                variant="default"
              >
                Open in New Tab <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={currentUrl}
              className="absolute inset-0 w-full h-full border-0"
              title="Web Browser"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation"
              onError={handleIframeError}
              onLoad={() => {
                setIsLoading(false);
                if (isFrameBlocked) {
                  handleIframeError();
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}