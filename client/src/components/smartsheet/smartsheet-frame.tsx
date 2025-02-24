import { useSmartsheet } from "@/lib/smartsheet-context";
import { useSheetUpdates } from "@/hooks/use-sheet-updates";
import SmartsheetContainer from "./smartsheet-container";

export default function SmartsheetFrame() {
  const { currentSheetId } = useSmartsheet();

  // Set up real-time updates
  useSheetUpdates(currentSheetId);

  // Return null if no sheet ID (modal will handle this state)
  if (!currentSheetId) {
    return null;
  }

  return <SmartsheetContainer sheetId={currentSheetId} />;
}
