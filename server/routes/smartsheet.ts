import { Router } from "express";
import { z } from "zod";
import { smartsheetTools } from "../tools/smartsheet";
import { requireSmartsheetAuth } from "../middleware/smartsheet-auth";

const router = Router();

// Apply Smartsheet authentication middleware to all routes
// Convert to async middleware
router.use(async (req, res, next) => {
  await requireSmartsheetAuth(req, res, next);
});

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

// Verify sheet access
router.get("/verify/:sheetId", async (req, res) => {
  try {
    const sheetId = req.params.sheetId;
    console.log(`Received request to verify sheet access for ID: ${sheetId}`);
    
    // Log session ID for debugging
    const sessionId = req.headers["x-session-id"];
    console.log(`Session ID: ${sessionId}`);
    
    if (!sheetId) {
      console.log('No sheet ID provided');
      return res.status(400).json({
        success: false,
        error: "Sheet ID is required"
      });
    }

    // Use the environment variable for access token
    const token = process.env.SMARTSHEET_ACCESS_TOKEN || "";
    if (!token) {
      console.error('SMARTSHEET_ACCESS_TOKEN environment variable is not set');
      return res.status(500).json({
        success: false,
        error: "Smartsheet access token is not configured"
      });
    }
    
    smartsheetTools.setAccessToken(token);
    
    // Log the token for debugging (first few characters only)
    console.log(`Using Smartsheet token: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`);
    
    // Verify sheet access
    console.log(`Calling verifySheetAccess for sheet ID: ${sheetId}`);
    const hasAccess = await smartsheetTools.verifySheetAccess(sheetId);
    console.log(`Sheet access verification result: ${hasAccess ? 'Success' : 'Failed'}`);
    
    if (hasAccess) {
      console.log('Sheet is accessible, sending success response');
      res.json({
        success: true,
        message: "Sheet is accessible"
      });
    } else {
      console.log('Sheet is not accessible, sending 403 response');
      res.status(403).json({
        success: false,
        error: "Unable to access sheet. Please check the Sheet ID and your permissions."
      });
    }
  } catch (error: any) {
    console.error("Error verifying sheet access:", error);
    
    // Provide more specific error messages based on the error type
    if (error.statusCode === 401) {
      res.status(401).json({
        success: false,
        error: "Authentication failed. Please check your Smartsheet access token."
      });
    } else if (error.statusCode === 403) {
      res.status(403).json({
        success: false,
        error: "You don't have permission to access this sheet."
      });
    } else if (error.statusCode === 404) {
      res.status(404).json({
        success: false,
        error: "Sheet not found. Please check the Sheet ID."
      });
    } else {
      res.status(error.statusCode || 400).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to verify sheet access"
      });
    }
  }
});

// Get sheet information by ID
router.get("/:sheetId", async (req, res) => {
  try {
    const sheetId = req.params.sheetId;
    
    if (!sheetId) {
      return res.status(400).json({
        success: false,
        error: "Sheet ID is required"
      });
    }

    // Use the environment variable for access token
    smartsheetTools.setAccessToken(process.env.SMARTSHEET_ACCESS_TOKEN || "");
    
    // Get actual sheet information from Smartsheet API
    const result = await smartsheetTools.getSheetInfo({ sheetId });
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error: any) {
    console.error("Error retrieving sheet information:", error);
    
    // Provide more specific error messages based on the error type
    if (error.statusCode === 401) {
      res.status(401).json({
        success: false,
        error: "Authentication failed. Please check your Smartsheet access token."
      });
    } else if (error.statusCode === 403) {
      res.status(403).json({
        success: false,
        error: "You don't have permission to access this sheet."
      });
    } else if (error.statusCode === 404) {
      res.status(404).json({
        success: false,
        error: "Sheet not found. Please check the Sheet ID."
      });
    } else {
      res.status(error.statusCode || 400).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to retrieve sheet information"
      });
    }
  }
});

export default router;
