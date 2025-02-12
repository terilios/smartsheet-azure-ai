import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SmartsheetContextType {
  currentSheetId: string | null;
  currentSessionId: string | null;
  setCurrentSheetId: (id: string | null) => void;
  setCurrentSessionId: (id: string | null) => void;
  clearSession: () => void;
}

const STORAGE_KEY = 'smartsheet_session';

interface StoredSession {
  sheetId: string | null;
  sessionId: string | null;
}

const SmartsheetContext = createContext<SmartsheetContextType | undefined>(undefined);

export function SmartsheetProvider({ children }: { children: ReactNode }) {
  // Initialize state from localStorage if available
  const [currentSheetId, setCurrentSheetId] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const session = JSON.parse(stored) as StoredSession;
        return session.sheetId;
      }
    } catch (error) {
      console.error('Error reading from localStorage:', error);
    }
    return null;
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const session = JSON.parse(stored) as StoredSession;
        return session.sessionId;
      }
    } catch (error) {
      console.error('Error reading from localStorage:', error);
    }
    return null;
  });

  // Update localStorage when state changes
  useEffect(() => {
    try {
      const session: StoredSession = {
        sheetId: currentSheetId,
        sessionId: currentSessionId
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  }, [currentSheetId, currentSessionId]);

  const clearSession = () => {
    setCurrentSheetId(null);
    setCurrentSessionId(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  };

  // Handle storage events from other tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        try {
          if (event.newValue) {
            const session = JSON.parse(event.newValue) as StoredSession;
            setCurrentSheetId(session.sheetId);
            setCurrentSessionId(session.sessionId);
          } else {
            clearSession();
          }
        } catch (error) {
          console.error('Error handling storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <SmartsheetContext.Provider 
      value={{ 
        currentSheetId, 
        currentSessionId, 
        setCurrentSheetId, 
        setCurrentSessionId,
        clearSession
      }}
    >
      {children}
    </SmartsheetContext.Provider>
  );
}

export function useSmartsheet() {
  const context = useContext(SmartsheetContext);
  if (context === undefined) {
    throw new Error('useSmartsheet must be used within a SmartsheetProvider');
  }
  return context;
}
