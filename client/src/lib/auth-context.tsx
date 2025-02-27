import React, { createContext, useContext, useState, useEffect } from 'react';

// Default user ID constant - must match the server-side constant
export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * User interface representing an authenticated user
 */
interface User {
  id: string;
  email: string;
  name: string;
}

/**
 * Authentication context interface
 */
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

/**
 * Authentication context
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication provider props
 */
interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Authentication provider component
 * 
 * This component provides authentication state and functions to the application.
 * It uses local storage to persist the authentication token.
 * 
 * @param props Component props
 * @returns AuthProvider component
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  
  // For development, use a default user
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('AuthProvider: Using default user for development');
      setUser({
        id: DEFAULT_USER_ID,
        email: 'default@childrens.harvard.edu',
        name: 'Default User'
      });
      setIsAuthenticated(true);
    } else if (token) {
      // In production, validate token on load
      validateToken();
    }
  }, []);
  
  /**
   * Validate the authentication token
   */
  const validateToken = async () => {
    try {
      // This would call your backend to validate the token
      // For now, just set a default user
      const response = await fetch('/api/auth/validate', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        // Token is invalid
        logout();
      }
    } catch (error) {
      console.error('Token validation failed:', error);
      logout();
    }
  };
  
  /**
   * Log in with a token
   * @param newToken Authentication token
   */
  const login = async (newToken: string) => {
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    await validateToken();
  };
  
  /**
   * Log out
   */
  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };
  
  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to use the authentication context
 * @returns Authentication context
 * @throws Error if used outside of AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};