import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface EditableCellProps {
  value: any;
  columnType: string;
  columnId: string;
  rowId: string;
  sheetId: string;
  isEditable: boolean;
  options?: string[];
}

export function EditableCell({
  value,
  columnType,
  columnId,
  rowId,
  sheetId,
  isEditable,
  options
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<any>(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    // Focus input when entering edit mode
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Update local state when prop value changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleDoubleClick = () => {
    if (isEditable) {
      setIsEditing(true);
    }
  };

  const handleBlur = async () => {
    if (!isEditing) return;
    
    // Only save if value has changed
    if (editValue !== value) {
      await saveChanges();
    }
    setIsEditing(false);
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await handleBlur();
    } else if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  const saveChanges = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/smartsheet/${sheetId}/rows/${rowId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          columnId,
          value: editValue
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update cell");
      }

      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ["sheetData", sheetId] });

      toast({
        title: "Cell Updated",
        description: "Your changes have been saved.",
      });
    } catch (error) {
      console.error("Failed to save cell:", error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to save changes",
        variant: "destructive",
      });
      // Revert to original value
      setEditValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  // Render based on column type
  const renderContent = () => {
    if (isSaving) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }

    if (isEditing) {
      switch (columnType) {
        case "CHECKBOX":
          return (
            <Checkbox
              checked={editValue}
              onCheckedChange={(checked) => {
                setEditValue(checked);
                saveChanges();
              }}
            />
          );

        case "DATE":
          return (
            <Input
              ref={inputRef}
              type="date"
              value={editValue ? format(new Date(editValue), "yyyy-MM-dd") : ""}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full"
            />
          );

        case "PICKLIST":
          return (
            <select
              value={editValue || ""}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              className="w-full p-2 border rounded"
            >
              <option value="">Select...</option>
              {options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          );

        default:
          return (
            <Input
              ref={inputRef}
              type="text"
              value={editValue || ""}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full"
            />
          );
      }
    }

    // Display mode
    switch (columnType) {
      case "CHECKBOX":
        return (
          <Checkbox
            checked={value}
            disabled
          />
        );

      case "DATE":
        return value ? format(new Date(value), "MMM d, yyyy") : "";

      default:
        return value || "";
    }
  };

  return (
    <div
      className={`p-2 min-h-[2rem] ${
        isEditable ? "cursor-pointer hover:bg-accent/50" : ""
      }`}
      onDoubleClick={handleDoubleClick}
    >
      {renderContent()}
    </div>
  );
}
