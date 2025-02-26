import React, { useState, memo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings, X } from "lucide-react";
import { BulkOperation } from "./bulk-operation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import SheetViewer from "./sheet-viewer";
import ConfigForm from "./config-form";
import ConfigurationError from "./configuration-error";

import { type ColumnMetadata, type SheetData } from "@shared/schema";
import { type ApiErrorResponse, type SheetError } from "@/lib/types";

class SmartsheetError extends Error implements SheetError {
  code?: string;
  statusCode?: number;
  details?: unknown;

  constructor(message: string, apiError?: ApiErrorResponse) {
    super(message);
    this.name = 'SmartsheetError';
    if (apiError) {
      this.code = apiError.code;
      this.statusCode = apiError.statusCode;
      this.details = apiError.details;
    }
  }
}

interface HeaderProps {
  sheetName: string;
  sheetId: string;
  columns: ColumnMetadata[];
  onConfigureClick: () => void;
  onRefresh: () => void;
}

const Header = memo(({ sheetName, sheetId, columns, onConfigureClick, onRefresh }: HeaderProps) => {
  // Display name can be truncated if too long
  const displayName = sheetName.length > 40 ? `${sheetName.slice(0, 37)}...` : sheetName;
  
  return (
    <div className="border-b p-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold" title={sheetName}>{displayName}</h2>
      <div className="flex items-center gap-2">
        <BulkOperation
          sheetId={sheetId}
          columns={columns}
          onComplete={onRefresh}
        />
        <Separator orientation="vertical" className="h-6" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onConfigureClick}
          title="Configure Smartsheet Integration"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

Header.displayName = "Header";

interface SmartsheetContainerProps {
  sheetId: string;
}

interface QueryResponse {
  data: SheetData;
}

export default function SmartsheetContainer({ sheetId }: SmartsheetContainerProps): JSX.Element {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  // Close the sheet after successful configuration
  useEffect(() => {
    if (configSaved) {
      const timer = setTimeout(() => {
        setIsConfigOpen(false);
        setConfigSaved(false);
      }, 1500); // Give time for the success message to be seen
      return () => clearTimeout(timer);
    }
  }, [configSaved]);

  const { data: response, error, isLoading } = useQuery<QueryResponse, SmartsheetError>({
    queryKey: ["/api/smartsheet", sheetId],
    queryFn: async () => {
      console.log(`Fetching sheet data for sheet ID: ${sheetId}`);
      const res = await apiRequest("GET", `/api/smartsheet/${sheetId}`);
      if (!res.ok) {
        const errorData = await res.json() as ApiErrorResponse;
        console.error('Error fetching sheet data:', errorData);
        throw new SmartsheetError(
          errorData.error || "Failed to fetch sheet data",
          errorData
        );
      }
      const data = await res.json() as QueryResponse;
      console.log('Sheet data received:', data);
      return data;
    }
  });

  if (error?.code === "SMARTSHEET_NOT_CONFIGURED") {
    return (
      <ConfigurationError onConfigure={() => setIsConfigOpen(true)} />
    );
  }

  return (
    <>
      <div className="h-full flex flex-col">
        {!error && !isLoading && response && (
          <Header
            sheetName={response.data.sheetName}
            sheetId={sheetId}
            columns={response.data.columns}
            onConfigureClick={() => setIsConfigOpen(true)}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/api/smartsheet", sheetId] })}
          />
        )}
        <div className="flex-1 overflow-auto">
          <SheetViewer 
            data={response?.data}
            isLoading={isLoading}
            error={error}
            onRetry={() => queryClient.invalidateQueries({ queryKey: ["/api/smartsheet", sheetId] })}
          />
        </div>
      </div>
      
      <Sheet open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader className="relative">
            <SheetClose className="absolute right-0 top-0">
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </SheetClose>
            <SheetTitle>Configure Smartsheet Integration</SheetTitle>
            <SheetDescription>
              Enter your Smartsheet API key to enable integration with your sheets.
              You can find your API key in your{" "}
              <a 
                href="https://app.smartsheet.com/account/user#apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Smartsheet account settings
              </a>.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <ConfigForm onSuccess={() => setConfigSaved(true)} />
            <SheetClose asChild>
              <Button variant="outline" className="w-full">
                Close
              </Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
