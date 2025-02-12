import { openSheetSchema } from "../../server/tools/smartsheet";
import { z } from "zod";

// Test input: a plain numeric string for Smartsheet ID
const testSheetId = "4104733329411972";

console.log("Testing validation for Smartsheet ID:", testSheetId);

try {
  // Validate using the existing schema
  const validated = openSheetSchema.parse({ sheetId: testSheetId });
  console.log("Validation passed:", validated);
} catch (error) {
  console.error("Validation failed:", error);
}

// Additionally, check conversion to a number (if needed by the Smartsheet client)
const numericSheetId = Number(testSheetId);
console.log("Converted sheet ID (as number):", numericSheetId);

if (Number.isNaN(numericSheetId)) {
  console.error("Conversion to number failed.");
} else {
  console.log("Sheet ID as number is valid.");
}
