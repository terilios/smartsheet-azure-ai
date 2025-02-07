import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { type Message } from "@shared/schema";
import { Loader2, ExternalLink, ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SmartsheetFrame() {
  const [url, setUrl] = useState("https://www.smartsheet.com/customers-home");
  const [currentUrl, setCurrentUrl] = useState(url);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
  };

  const openInNewTab = () => {
    window.open(currentUrl, '_blank');
  };

  const handleBack = () => {
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.history.back();
      } catch (e) {
        setError("Navigation not available due to security restrictions.");
      }
    }
  };

  const handleForward = () => {
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.history.forward();
      } catch (e) {
        setError("Navigation not available due to security restrictions.");
      }
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = currentUrl;
      setError(null);
      setIsLoading(true);
    }
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError("Unable to load page. Some pages may not allow embedding.");
  };

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
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={handleForward}
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
          type="url"
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
          <Card className="m-4 p-4">
            <CardContent>
              <p className="text-destructive mb-2">{error}</p>
              <p className="text-sm text-muted-foreground">
                Click the external link button to open this page in a new tab.
              </p>
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
              allow="fullscreen"
              onError={handleIframeError}
              onLoad={() => {
                setIsLoading(false);
                try {
                  const iframeLocation = iframeRef.current?.contentWindow?.location.href;
                  if (iframeLocation) {
                    setUrl(iframeLocation);
                    setCurrentUrl(iframeLocation);
                  }
                } catch (e) {
                  // Ignore cross-origin errors when trying to access location
                  console.log("Cross-origin navigation occurred");
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}