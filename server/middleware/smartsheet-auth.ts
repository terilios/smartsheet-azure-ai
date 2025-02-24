import { Request, Response, NextFunction } from "express";
import { smartsheetTools } from "../tools/smartsheet";

export function requireSmartsheetAuth(req: Request, res: Response, next: NextFunction) {
  // Skip auth check for the config endpoint itself
  if (req.path === "/api/smartsheet/config") {
    return next();
  }

  try {
    // This will throw if not configured
    smartsheetTools["ensureClient"]();
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: "Smartsheet is not configured. Please set your access token first.",
      code: "SMARTSHEET_NOT_CONFIGURED"
    });
  }
}
