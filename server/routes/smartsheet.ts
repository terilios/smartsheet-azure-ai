import { Router } from "express";
import { z } from "zod";
import { smartsheetTools } from "../tools/smartsheet";

const router = Router();

// Schema for config validation
const configSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
  sheetId: z.string().min(1, "Sheet ID is required"),
});

// Set Smartsheet configuration
router.post("/config", async (req, res) => {
  try {
    const { accessToken, sheetId } = configSchema.parse(req.body);
    
    // Set the access token in the Smartsheet tools instance
    smartsheetTools.setAccessToken(accessToken);
    
    // Verify the configuration by attempting to get sheet info
    const result = await smartsheetTools.getSheetInfo({ sheetId });
    
    res.json({
      success: true,
      message: "Smartsheet configuration updated successfully",
      data: {
        sheetId,
        sheetName: result.data.sheetName,
      }
    });
  } catch (error) {
    console.error("Error updating Smartsheet configuration:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update Smartsheet configuration"
    });
  }
});

export default router;
