import { Router } from "express";
import { storage } from "../storage";

const router = Router();

// Create a new session
router.post("/", async (req, res) => {
  try {
    const { sheetId } = req.body;
    if (!sheetId) {
      return res.status(400).json({ 
        success: false, 
        error: "sheetId is required" 
      });
    }

    const sessionId = await storage.createSession(sheetId);
    res.json({ success: true, sessionId });
  } catch (error) {
    console.error("Error in chat session creation:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown chat session error'
    });
  }
});

// Get session info
router.get("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "sessionId is required"
      });
    }

    const session = await storage.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found"
      });
    }

    res.json(session);
  } catch (error) {
    console.error("Error getting chat session:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown chat session error'
    });
  }
});

export default router;
