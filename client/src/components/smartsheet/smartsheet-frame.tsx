import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { type Message } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export default function SmartsheetFrame() {
  const [url, setUrl] = useState("https://www.smartsheet.com/customers-home");
  const [currentUrl, setCurrentUrl] = useState(url);
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentUrl(url);
  };

  const openInNewTab = () => {
    window.open(currentUrl, '_blank');
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
        <iframe
          src={currentUrl}
          className="absolute inset-0 w-full h-full border-0"
          title="Smartsheet"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}