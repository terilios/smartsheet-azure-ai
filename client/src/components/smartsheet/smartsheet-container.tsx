import React, { useState, memo, useEffect } from "react";
import { Settings, X, RefreshCw } from "lucide-react";
import { BulkOperation } from "./bulk-operation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import SheetViewer from "./sheet-viewer";
import ConfigForm from "./config-form";
import ConfigurationError from "./configuration-error";
import { useSmartsheet } from "@/lib/smartsheet-context";

import { type ColumnMetadata } from "@shared/schema";

interface HeaderProps {
  sheetName: string;
  sheetId: string;
  columns: ColumnMetadata[];
  onConfigureClick: () => void;
  onRefresh: () => void;
  lastUpdated: Date | null;
}

const Header = memo(({ sheetName, sheetId, columns, onConfigureClick, onRefresh, lastUpdated }: HeaderProps) => {
  // Display name can be truncated if too long
  const displayName = sheetName.length > 40 ? `${sheetName.slice(0, 37)}...` : sheetName;
  
  return (
    <div className="border-b p-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold" title={sheetName}>{displayName}</h2>
        {lastUpdated && (
          <span className="text-xs text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          title="Refresh Sheet Data"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
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

export default function SmartsheetContainer({ sheetId }: SmartsheetContainerProps): JSX.Element {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const {
    sheetData,
    isLoading,
    error,
    refreshSheetData,
    lastUpdated,
    setCurrentSheetId
  } = useSmartsheet();

  // Set the current sheet ID when the component mounts or sheetId changes
  useEffect(() => {
    setCurrentSheetId(sheetId);
  }, [sheetId, setCurrentSheetId]);

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

  if (error?.code === "SMARTSHEET_NOT_CONFIGURED") {
    return (
      <ConfigurationError onConfigure={() => setIsConfigOpen(true)} />
    );
  }

  return (
    <>
      <div className="h-full flex flex-col">
        {!error && !isLoading && sheetData && (
          <Header
            sheetName={sheetData.sheetName}
            sheetId={sheetId}
            columns={sheetData.columns}
            onConfigureClick={() => setIsConfigOpen(true)}
            onRefresh={refreshSheetData}
            lastUpdated={lastUpdated}
          />
        )}
        <div className="flex-1 overflow-auto">
          <SheetViewer
            data={sheetData || undefined}
            isLoading={isLoading}
            error={error}
            onRetry={refreshSheetData}
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
            <ConfigForm
              onSuccess={() => {
                setConfigSaved(true);
                refreshSheetData(); // Refresh data after config is saved
              }}
            />
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
