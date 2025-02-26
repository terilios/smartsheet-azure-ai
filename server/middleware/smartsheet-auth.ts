import { Request, Response, NextFunction } from "express";
import { smartsheetTools } from "../tools/smartsheet";

// Extend the Express Request type to include sessionId in body
declare global {
  namespace Express {
    interface Request {
      body: {
        sessionId?: string;
        [key: string]: any;
      }
    }
  }
}

export async function requireSmartsheetAuth(req: Request, res: Response, next: NextFunction) {
  // Skip auth check for the config endpoint itself
  if (req.path === "/config") {
    return next();
  }

  // Skip auth check for the verify endpoint
  if (req.path.startsWith("/verify/")) {
    return next();
  }

  // Check for session ID in request body or headers
  const sessionId = req.body?.sessionId || req.headers["x-session-id"];
  
  // For PATCH requests to update cells, require a session ID
  if (req.method === "PATCH" && req.path.includes("/rows/")) {
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid session ID",
        code: "SESSION_REQUIRED"
      });
    }
    
    // Store the session ID in the request for later use
    req.body.sessionId = sessionId;
  }

  // Set the access token from the environment variable
  const token = process.env.SMARTSHEET_ACCESS_TOKEN || "";
  if (!token) {
    console.error('SMARTSHEET_ACCESS_TOKEN environment variable is not set');
    return res.status(401).json({
      success: false,
      error: "Smartsheet access token is not configured in the environment.",
      code: "SMARTSHEET_NOT_CONFIGURED"
    });
  }

  smartsheetTools.setAccessToken(token);

  try {
    // This will throw if not configured
    await smartsheetTools.ensureClient();
    next();
  } catch (error) {
    console.error('Error in Smartsheet authentication middleware:', error);
    res.status(401).json({
      success: false,
      error: "Smartsheet is not configured properly. Please check your access token.",
      code: "SMARTSHEET_NOT_CONFIGURED"
    });
  }
}
