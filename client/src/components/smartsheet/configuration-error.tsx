import { AlertCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ConfigurationErrorProps {
  onConfigure: () => void;
}

export default function ConfigurationError({ onConfigure }: ConfigurationErrorProps): JSX.Element {
  return (
    <Card className="flex flex-col h-full">
      <div className="flex-1 p-8">
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-6 max-w-md mx-auto">
            <div className="text-amber-500">
              <AlertCircle className="h-12 w-12 mx-auto" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Smartsheet Not Configured</h2>
              <p className="text-muted-foreground">
                To get started, you'll need to configure your Smartsheet integration
                with an API access token. This token allows secure access to your sheets.
              </p>
            </div>
            <Button 
              onClick={onConfigure}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Configure Integration
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
