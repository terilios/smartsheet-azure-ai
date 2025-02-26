import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { apiRequest } from './queryClient';
import { type SheetData, type ColumnMetadata } from '@shared/schema';
import { type SheetError } from '@/lib/types';

// Filter criteria for row filtering
export interface FilterCriteria {
  columnId: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'isEmpty' | 'isNotEmpty';
  value?: any;
}

// Sort options for row sorting
export interface SortOptions {
  columnId: string;
  direction: 'asc' | 'desc';
}

// Cache configuration
export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  enabled: boolean;
}

interface SmartsheetContextType {
  // Basic session management
  currentSheetId: string | null;
  currentSessionId: string | null;
  setCurrentSheetId: (id: string | null) => void;
  setCurrentSessionId: (id: string | null) => void;
  clearSession: () => void;
  
  // Enhanced sheet data management
  sheetData: SheetData | null;
  isLoading: boolean;
  error: SheetError | null;
  refreshSheetData: () => Promise<void>;
  lastUpdated: Date | null;
  
  // New data operations
  filterRows: (criteria: FilterCriteria[]) => SheetData | null;
  sortRows: (options: SortOptions) => SheetData | null;
  getColumnData: (columnId: string) => any[];
  
  // Cache management
  cacheTimestamp: Date | null;
  isCacheValid: boolean;
  invalidateCache: () => void;
  setCacheConfig: (config: Partial<CacheConfig>) => void;
  
  // Row and cell operations
  refreshRowData: (rowId: string) => Promise<void>;
  refreshCellData: (rowId: string, columnId: string) => Promise<void>;
}

const STORAGE_KEY = 'smartsheet_session';
const CACHE_KEY = 'smartsheet_cache';

// Default cache configuration
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttl: 5 * 60 * 1000, // 5 minutes
  enabled: true
};

interface StoredCache {
  data: SheetData | null;
  timestamp: string;
  sheetId: string;
}

interface StoredSession {
  sheetId: string | null;
  sessionId: string | null;
}

class SmartsheetError extends Error implements SheetError {
  code?: string;
  statusCode?: number;
  details?: unknown;

  constructor(message: string, apiError?: any) {
    super(message);
    this.name = 'SmartsheetError';
    if (apiError) {
      this.code = apiError.code;
      this.statusCode = apiError.statusCode;
      this.details = apiError.details;
    }
  }
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

  // Enhanced sheet data state
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<SheetError | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Cache management state
  const [cacheTimestamp, setCacheTimestamp] = useState<Date | null>(null);
  const [cacheConfig, setCacheConfigState] = useState<CacheConfig>(DEFAULT_CACHE_CONFIG);

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

  // Fetch sheet data when sheetId changes
  useEffect(() => {
    if (currentSheetId && currentSessionId) {
      refreshSheetData();
    } else {
      // Clear sheet data if no sheet ID or session ID
      setSheetData(null);
      setError(null);
    }
  }, [currentSheetId, currentSessionId]);

  // Function to refresh sheet data with caching
  const refreshSheetData = async () => {
    if (!currentSheetId || !currentSessionId) {
      console.warn('Cannot refresh sheet data: No sheet ID or session ID');
      return;
    }
    
    // Check if we can use cached data
    if (cacheConfig.enabled && isCacheValid()) {
      try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
          const parsedCache = JSON.parse(cachedData) as StoredCache;
          if (parsedCache.sheetId === currentSheetId && parsedCache.data) {
            console.log('Using cached sheet data');
            setSheetData(parsedCache.data);
            return;
          }
        }
      } catch (error) {
        console.error('Error reading from cache:', error);
        // Continue with fetching fresh data if cache read fails
      }
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching sheet data for sheet ID: ${currentSheetId}`);
      const res = await apiRequest("GET", `/api/smartsheet/${currentSheetId}`);
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Error fetching sheet data:', errorData);
        throw new SmartsheetError(
          errorData.error || "Failed to fetch sheet data",
          errorData
        );
      }
      
      const data = await res.json();
      console.log('Sheet data received:', data);
      
      // Update state
      setSheetData(data.data);
      const now = new Date();
      setLastUpdated(now);
      setCacheTimestamp(now);
      
      // Update cache if enabled
      if (cacheConfig.enabled) {
        try {
          const cacheData: StoredCache = {
            data: data.data,
            timestamp: now.toISOString(),
            sheetId: currentSheetId
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        } catch (error) {
          console.error('Error writing to cache:', error);
        }
      }
    } catch (error) {
      console.error("Error fetching sheet data:", error);
      setError(error instanceof SmartsheetError ? error : new SmartsheetError(
        error instanceof Error ? error.message : "Unknown error"
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const clearSession = () => {
    setCurrentSheetId(null);
    setCurrentSessionId(null);
    setSheetData(null);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  };

  // Cache management methods
  const isCacheValid = useCallback(() => {
    if (!cacheTimestamp || !cacheConfig.enabled) return false;
    const now = new Date();
    return now.getTime() - cacheTimestamp.getTime() < cacheConfig.ttl;
  }, [cacheTimestamp, cacheConfig]);

  const invalidateCache = useCallback(() => {
    setCacheTimestamp(null);
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error('Error clearing cache from localStorage:', error);
    }
  }, []);

  const setCacheConfig = useCallback((config: Partial<CacheConfig>) => {
    setCacheConfigState(prev => ({ ...prev, ...config }));
  }, []);

  // Data operation methods
  const filterRows = useCallback((criteria: FilterCriteria[]): SheetData | null => {
    if (!sheetData) return null;
    
    const filteredRows = sheetData.rows.filter(row => {
      return criteria.every(criterion => {
        const column = sheetData.columns.find(col => col.id === criterion.columnId);
        if (!column) return false;
        
        const value = row[column.title];
        
        switch (criterion.operator) {
          case 'equals':
            return value === criterion.value;
          case 'contains':
            return String(value).toLowerCase().includes(String(criterion.value).toLowerCase());
          case 'greaterThan':
            return Number(value) > Number(criterion.value);
          case 'lessThan':
            return Number(value) < Number(criterion.value);
          case 'isEmpty':
            return value === undefined || value === null || value === '';
          case 'isNotEmpty':
            return value !== undefined && value !== null && value !== '';
          default:
            return false;
        }
      });
    });
    
    return {
      ...sheetData,
      rows: filteredRows,
      totalRows: filteredRows.length
    };
  }, [sheetData]);

  const sortRows = useCallback((options: SortOptions): SheetData | null => {
    if (!sheetData) return null;
    
    const column = sheetData.columns.find(col => col.id === options.columnId);
    if (!column) return sheetData;
    
    const sortedRows = [...sheetData.rows].sort((a, b) => {
      const valueA = a[column.title];
      const valueB = b[column.title];
      
      // Handle different types of values
      if (valueA === valueB) return 0;
      if (valueA === undefined || valueA === null) return options.direction === 'asc' ? -1 : 1;
      if (valueB === undefined || valueB === null) return options.direction === 'asc' ? 1 : -1;
      
      // Compare based on type
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return options.direction === 'asc' ? valueA - valueB : valueB - valueA;
      }
      
      // Default string comparison
      const strA = String(valueA).toLowerCase();
      const strB = String(valueB).toLowerCase();
      
      return options.direction === 'asc'
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
    
    return {
      ...sheetData,
      rows: sortedRows
    };
  }, [sheetData]);

  const getColumnData = useCallback((columnId: string): any[] => {
    if (!sheetData) return [];
    
    const column = sheetData.columns.find(col => col.id === columnId);
    if (!column) return [];
    
    return sheetData.rows.map(row => row[column.title]);
  }, [sheetData]);

  // Row and cell operations
  const refreshRowData = useCallback(async (rowId: string): Promise<void> => {
    if (!currentSheetId || !currentSessionId) {
      console.warn('Cannot refresh row data: No sheet ID or session ID');
      return;
    }
    
    try {
      const res = await apiRequest("GET", `/api/smartsheet/${currentSheetId}/rows/${rowId}`);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new SmartsheetError(
          errorData.error || "Failed to fetch row data",
          errorData
        );
      }
      
      const data = await res.json();
      
      // Update the specific row in the sheet data
      setSheetData(prevData => {
        if (!prevData) return null;
        
        const updatedRows = prevData.rows.map(row =>
          row.id === rowId ? data.row : row
        );
        
        return {
          ...prevData,
          rows: updatedRows
        };
      });
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error(`Error fetching row data for row ${rowId}:`, error);
    }
  }, [currentSheetId, currentSessionId]);

  const refreshCellData = useCallback(async (rowId: string, columnId: string): Promise<void> => {
    if (!currentSheetId || !currentSessionId) {
      console.warn('Cannot refresh cell data: No sheet ID or session ID');
      return;
    }
    
    try {
      const res = await apiRequest("GET", `/api/smartsheet/${currentSheetId}/rows/${rowId}/cells/${columnId}`);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new SmartsheetError(
          errorData.error || "Failed to fetch cell data",
          errorData
        );
      }
      
      const data = await res.json();
      
      // Update the specific cell in the sheet data
      setSheetData(prevData => {
        if (!prevData) return null;
        
        const column = prevData.columns.find(col => col.id === columnId);
        if (!column) return prevData;
        
        const updatedRows = prevData.rows.map(row => {
          if (row.id === rowId) {
            return {
              ...row,
              [column.title]: data.value
            };
          }
          return row;
        });
        
        return {
          ...prevData,
          rows: updatedRows
        };
      });
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error(`Error fetching cell data for row ${rowId}, column ${columnId}:`, error);
    }
  }, [currentSheetId, currentSessionId]);

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
        // Basic session management
        currentSheetId,
        currentSessionId,
        setCurrentSheetId,
        setCurrentSessionId,
        clearSession,
        
        // Enhanced sheet data management
        sheetData,
        isLoading,
        error,
        refreshSheetData,
        lastUpdated,
        
        // New data operations
        filterRows,
        sortRows,
        getColumnData,
        
        // Cache management
        cacheTimestamp,
        isCacheValid: isCacheValid(),
        invalidateCache,
        setCacheConfig,
        
        // Row and cell operations
        refreshRowData,
        refreshCellData
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
