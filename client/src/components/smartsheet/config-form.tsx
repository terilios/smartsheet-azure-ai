import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSmartsheetConfigSchema, type SmartsheetConfigResponse } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";

interface ConfigFormProps {
  onSuccess?: () => void;
}

interface ConfigFormData {
  sheetId: string;
  accessToken: string;
}

export default function ConfigForm({ onSuccess }: ConfigFormProps) {
  const form = useForm<ConfigFormData>({
    resolver: zodResolver(insertSmartsheetConfigSchema),
    defaultValues: {
      sheetId: "",
      accessToken: "",
    },
  });

  const [showToken, setShowToken] = useState(false);
  const [hasError, setHasError] = useState(false);
  const { toast } = useToast();

  // Reset error state when form values change
  useEffect(() => {
    if (hasError) {
      setHasError(false);
    }
  }, [form.watch(), hasError]);

  const { mutate: saveConfig, isPending, isSuccess } = useMutation({
    mutationFn: async (data: ConfigFormData): Promise<SmartsheetConfigResponse> => {
      const res = await apiRequest("POST", "/api/smartsheet/config", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update configuration");
      }
      return res.json();
    },
    onSuccess: (response: SmartsheetConfigResponse) => {
      queryClient.invalidateQueries({ queryKey: ["/api/smartsheet/config"] });
      toast({
        title: "Configuration Saved",
        description: response.message || "Your Smartsheet integration has been configured successfully.",
      });
      form.reset();
      onSuccess?.();
    },
    onError: (error: Error) => {
      setHasError(true);
      toast({
        title: "Configuration Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: ConfigFormData) {
    saveConfig(data);
  }

  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit(onSubmit)} 
        className="space-y-6"
        aria-labelledby="config-form-title"
        aria-describedby="config-form-description"
      >
        <div className="space-y-2">
          <h3 id="config-form-title" className="text-lg font-medium">
            Smartsheet Integration Settings
          </h3>
          <p id="config-form-description" className="text-sm text-muted-foreground">
            Configure your Smartsheet integration by providing your sheet ID and API access token.
            These settings will be securely stored and can be updated at any time.
          </p>
        </div>
        <FormField
          control={form.control}
          name="sheetId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sheet ID</FormLabel>
              <FormDescription>
                Find this in your sheet's URL: https://app.smartsheet.com/sheets/<span className="font-mono text-primary">SHEET_ID</span>
              </FormDescription>
              <FormControl>
                <Input 
                  placeholder="Enter your Smartsheet ID..." 
                  {...field} 
                  disabled={isPending}
                  className="font-mono"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  pattern="[0-9]+"
                  inputMode="numeric"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="accessToken"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Access Token</FormLabel>
              <FormDescription>
                Generate this in Smartsheet under Personal Settings → API Access
              </FormDescription>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder="Enter your Smartsheet access token..."
                    {...field}
                    disabled={isPending}
                    className="font-mono pr-10"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowToken(!showToken)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setShowToken(!showToken);
                      }
                    }}
                    disabled={isPending}
                    aria-pressed={showToken}
                    aria-label={showToken ? "Hide access token" : "Show access token"}
                  >
                    {showToken ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="sr-only">
                      {showToken ? "Hide token" : "Show token"}
                    </span>
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          disabled={isPending} 
          className="w-full relative"
          variant={isSuccess ? "outline" : hasError ? "destructive" : "default"}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Configuration...
            </>
          ) : isSuccess ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
              Configuration Saved
            </>
          ) : (
            "Save Configuration"
          )}
        </Button>
      </form>
    </Form>
  );
}
