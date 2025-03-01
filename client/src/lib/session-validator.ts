import axios from "axios";
import { useEffect, useState } from "react";

// Key used for storing the session ID in localStorage
const SESSION_ID_KEY = "chatsheetai-session-id";

export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_ID_KEY);
}

export function setSessionId(sessionId: string): void {
  localStorage.setItem(SESSION_ID_KEY, sessionId);
}

/**
 * Check if the current session is valid by querying the server.
 */
async function validateSessionApi(): Promise<boolean> {
  const sessionId = getSessionId();
  if (sessionId) {
    try {
      const response = await axios.get(`/api/session/${sessionId}`);
      return response.data.valid;
    } catch (error) {
      console.error("Error validating session via API:", error);
      localStorage.removeItem(SESSION_ID_KEY);
      return false;
    }
  }
  return false;
}

/**
 * Create a new session by calling the server.
 */
async function createSession(): Promise<string | null> {
  try {
    const newSessionResponse = await axios.post("/api/session");
    const newSessionId = newSessionResponse.data.sessionId;
    if (newSessionId) {
      setSessionId(newSessionId);
      return newSessionId;
    }
  } catch (error) {
    console.error("Error creating new session:", error);
  }
  return null;
}

/**
 * Custom React hook that provides session validation and management state.
 */
export function useSessionValidator() {
  const [isValid, setIsValid] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(true);
  const [hasSheetData, setHasSheetData] = useState<boolean>(false);

  async function validateSession(): Promise<boolean> {
    setIsValidating(true);
    const valid = await validateSessionApi();
    setIsValid(valid);
    setIsValidating(false);
    return valid;
  }

  async function recreateSession(): Promise<string | null> {
    const newSession = await createSession();
    if (newSession) {
      setIsValid(true);
      return newSession;
    }
    return null;
  }

  async function recoverSession(): Promise<boolean> {
    // Dummy recovery: in a real implementation, this would load sheet data into the session.
    setHasSheetData(true);
    return true;
  }

  useEffect(() => {
    // On mount, validate session.
    validateSession().catch((error) => {
      console.error("Session validation failed:", error);
    });
    // Assume that sheet data is loaded from elsewhere; set default to true for now.
    setHasSheetData(true);
  }, []);

  return { isValid, isValidating, hasSheetData, validateSession, recreateSession, recoverSession };
}
