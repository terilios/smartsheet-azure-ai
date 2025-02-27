/**
 * Authentication middleware for ChatSheetAI
 * 
 * This middleware validates authentication tokens and attaches the user to the request object.
 * It provides a development fallback that uses a default user when not in production.
 */

import { Request, Response, NextFunction } from 'express';
import { getAuthService } from '../services/auth';

/**
 * Extended Request interface with user property
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Authentication middleware
 * 
 * Validates the Authorization header and attaches the user to the request object.
 * In development mode, it will use a default user if no token is provided.
 * 
 * @param req Request object
 * @param res Response object
 * @param next Next function
 */
export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    // For development, use default user if no token provided
    if (!authHeader) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Auth middleware: No authorization header, using default user (development only)');
        req.user = getAuthService().getDefaultUser();
        return next();
      }
      return res.status(401).json({ error: 'No authorization header provided' });
    }
    
    // Extract token from Authorization header (Bearer TOKEN format)
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Invalid authorization header format' });
    }
    
    // Validate token
    const user = await getAuthService().validateToken(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Optional authentication middleware
 * 
 * Similar to authMiddleware but doesn't require authentication.
 * If a valid token is provided, it attaches the user to the request.
 * If no token is provided, it continues without attaching a user.
 * 
 * @param req Request object
 * @param res Response object
 * @param next Next function
 */
export const optionalAuthMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    // If no auth header, continue without user
    if (!authHeader) {
      return next();
    }
    
    // Extract token from Authorization header
    const token = authHeader.split(' ')[1];
    if (!token) {
      return next();
    }
    
    // Validate token
    const user = await getAuthService().validateToken(token);
    
    // Attach user to request if valid
    if (user) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Just log the error but continue
    console.error('Optional authentication error:', error);
    next();
  }
};