import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSmartsheetConfigSchema } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function ConfigForm() {
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(insertSmartsheetConfigSchema),
    defaultValues: {
      sheetId: "",
      accessToken: "",
    },
  });

  const { mutate: saveConfig, isPending } = useMutation({
    mutationFn: async (data: { sheetId: string; accessToken: string }) => {
      const res = await apiRequest("POST", "/api/smartsheet/config", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smartsheet/config"] });
      toast({
        title: "ChatSheetAI Configuration",
        description: "Your Smartsheet integration has been configured successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: { sheetId: string; accessToken: string }) {
    saveConfig(data);
  }

  return (
    <Card className="w-full max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Configure ChatSheetAI Integration</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="sheetId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sheet ID</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your Smartsheet ID..." {...field} />
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
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter your Smartsheet access token..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending}>
              Save Configuration
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}