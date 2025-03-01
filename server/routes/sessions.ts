import { Router } from "express";
import { storage } from "../storage";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { DEFAULT_USER_ID } from "../../migrations/0001_add_users";
import { sheetDataService } from "../services/sheet-data.js";
import { type SessionState } from "../../shared/schema";

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
    
    // Create session with user ID and INITIALIZING state
    const sessionId = await storage.createSession(userId, sheetId, "INITIALIZING");

    // Load sheet data immediately after session creation
    try {
      // Load sheet data using the sheet data service
      const dataLoaded = await sheetDataService.loadSheetData(sessionId, sheetId);
      
      if (!dataLoaded) {
        // If sheet data couldn't be loaded, update session state to ERROR
        await storage.updateSessionState(sessionId, "ERROR", "Failed to load sheet data");
        return res.status(400).json({
          success: false,
          error: "Failed to load sheet data for session"
        });
      }
      
      // Update session state to ACTIVE
      await storage.updateSessionState(sessionId, "ACTIVE");
      
      // Start periodic refresh of sheet data
      sheetDataService.startPeriodicRefresh(sessionId, sheetId);
      
      console.log(`Sheet data service initialized for session ${sessionId}`);
    } catch (sheetError) {
      // Update session state to ERROR
      await storage.updateSessionState(
        sessionId,
        "ERROR",
        sheetError instanceof Error ? sheetError.message : "Unknown error loading sheet data"
      );
      
      console.error(`Error initializing sheet data service for session ${sessionId}:`, sheetError);
      
      return res.status(500).json({
        success: false,
        error: "Failed to initialize sheet data service",
        sessionId
      });
    }

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
    // Ensure that a valid user_id is always used by falling back to the seeded default user ID
  const userId = (req.user && req.user.id) || "00000000-0000-0000-0000-000000000000";
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

// Explicitly load sheet data for a session
router.post("/:sessionId/load-data", async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId } = req.params;
    const { sheetId } = req.body;
    
    if (!sessionId || !sheetId) {
      return res.status(400).json({
        success: false,
        error: "sessionId and sheetId are required"
      });
    }
    
    // Get session to verify it exists
    const session = await storage.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found"
      });
    }
    
    // Update session state to initializing
    await storage.updateSessionState(sessionId, "INITIALIZING");
    
    // Load sheet data
    try {
      const dataLoaded = await sheetDataService.loadSheetData(sessionId, sheetId);
      
      if (!dataLoaded) {
        await storage.updateSessionState(sessionId, "ERROR", "Failed to load sheet data");
        return res.status(500).json({
          success: false,
          error: "Failed to load sheet data"
        });
      }
      
      // Update session state to active
      await storage.updateSessionState(sessionId, "ACTIVE");
      
      // Start periodic refresh
      sheetDataService.startPeriodicRefresh(sessionId, sheetId);
      
      res.json({
        success: true,
        message: "Sheet data loaded successfully"
      });
    } catch (error) {
      await storage.updateSessionState(
        sessionId,
        "ERROR",
        error instanceof Error ? error.message : "Unknown error loading sheet data"
      );
      
      console.error("Error loading sheet data:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  } catch (error) {
    console.error("Error in load-data endpoint:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
