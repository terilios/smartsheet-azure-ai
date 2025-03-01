import { db } from "../server/db";
import { updatedSessionsWithState } from "./0003_add_session_state";
import { eq } from "drizzle-orm";

/**
 * Migration script to update existing sessions with state information
 */
async function migrateSessionState() {
  console.log("Starting session state migration...");
  
  try {
    // Get all sessions
    const sessions = await db.select().from(updatedSessionsWithState);
    console.log(`Found ${sessions.length} sessions to migrate`);
    
    // Update each session with appropriate state
    for (const session of sessions) {
      // Check if session has sheet data
      const metadata = session.metadata as Record<string, any> | null;
      const hasSheetData = !!(metadata?.sheetData);
      
      // Set state based on sheet data presence
      const state = hasSheetData ? "ACTIVE" : "INITIALIZING";
      
      // Update session
      await db
        .update(updatedSessionsWithState)
        .set({
          state,
          updatedAt: new Date()
        })
        .where(eq(updatedSessionsWithState.id, session.id));
      
      console.log(`Updated session ${session.id} to state: ${state}`);
    }
    
    console.log("Session state migration completed successfully");
  } catch (error) {
    console.error("Error during session state migration:", error);
    process.exit(1);
  }
}

// Run the migration
migrateSessionState()
  .then(() => {
    console.log("Migration completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });