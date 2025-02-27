import { Router } from "express";
import { storage } from "../storage";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { DEFAULT_USER_ID } from "../../migrations/0001_add_users";

const router = Router();

// Apply auth middleware to all session routes
router.use(authMiddleware);

// Create a new session
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { sheetId } = req.body;
    if (!sheetId) {
      return res.status(400).json({
        success: false,
        error: "sheetId is required"
      });
    }

    // Get user ID from authenticated request
    const userId = req.user?.id || DEFAULT_USER_ID;
    
    // Create session with user ID
    const sessionId = await storage.createSession(userId, sheetId);
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
router.get("/:sessionId", async (req: AuthenticatedRequest, res) => {
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

    // Check if session belongs to user (in production)
    if (session.userId !== req.user?.id && process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: "Not authorized to access this session"
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

// Get all sessions for the current user
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated"
      });
    }

    const sessions = await storage.getSessionsByUser(userId);
    res.json({ success: true, sessions });
  } catch (error) {
    console.error("Error getting user sessions:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error getting sessions'
    });
  }
});

export default router;
