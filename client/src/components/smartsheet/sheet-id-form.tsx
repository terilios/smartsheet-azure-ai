import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const sheetIdSchema = z.object({
  sheetId: z.string().min(1, "Sheet ID is required"),
});

type SheetIdFormProps = {
  onSubmit: (sheetId: string) => void;
  disabled?: boolean;
};

export default function SheetIdForm({ onSubmit, disabled }: SheetIdFormProps) {
  const form = useForm<z.infer<typeof sheetIdSchema>>({
    resolver: zodResolver(sheetIdSchema),
    defaultValues: {
      sheetId: "",
    },
  });

  function handleSubmit(values: z.infer<typeof sheetIdSchema>) {
    onSubmit(values.sheetId);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="sheetId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Smartsheet ID</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your Smartsheet ID..."
                  disabled={disabled}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={disabled}>
          Continue
        </Button>
      </form>
    </Form>
  );
}
