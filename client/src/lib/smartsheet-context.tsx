import { createContext, useContext, useState, ReactNode } from 'react';

interface SmartsheetContextType {
  currentSheetId: string | null;
  currentSessionId: string | null;
  setCurrentSheetId: (id: string | null) => void;
  setCurrentSessionId: (id: string | null) => void;
  clearSession: () => void;
}

const SmartsheetContext = createContext<SmartsheetContextType | undefined>(undefined);

export function SmartsheetProvider({ children }: { children: ReactNode }) {
  const [currentSheetId, setCurrentSheetId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const clearSession = () => {
    setCurrentSheetId(null);
    setCurrentSessionId(null);
  };

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
