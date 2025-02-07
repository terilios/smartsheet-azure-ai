import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { type Message } from "@shared/schema";
import { Loader2, ExternalLink, ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SmartsheetFrame() {
  const [url, setUrl] = useState("https://www.smartsheet.com/customers-home");
  const [currentUrl, setCurrentUrl] = useState(url);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentUrl(url);
    setError(null);
  };

  const openInNewTab = () => {
    window.open(currentUrl, '_blank');
  };

  const handleBack = () => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.history.back();
    }
  };

  const handleForward = () => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.history.forward();
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = currentUrl;
    }
  };

  const handleIframeError = () => {
    setError("Unable to load page. Some pages may not allow embedding.");
  };

  if (isLoading) {
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
          placeholder="Enter Smartsheet URL..."
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
            <p className="text-destructive mb-2">{error}</p>
            <p className="text-sm text-muted-foreground">
              Click the external link button to open this page in a new tab.
            </p>
          </Card>
        ) : (
          <iframe
            ref={iframeRef}
            src={currentUrl}
            className="absolute inset-0 w-full h-full border-0"
            title="Smartsheet"
            allow="fullscreen"
            onError={handleIframeError}
          />
        )}
      </div>
    </div>
  );
}