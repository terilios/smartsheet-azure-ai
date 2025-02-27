/**
 * Authentication service for ChatSheetAI
 *
 * This service provides authentication functionality with a stub implementation
 * for development and preparation for AWS Cognito SSO/JWT integration.
 */

import { DEFAULT_USER_ID } from "../../migrations/0001_add_users";

/**
 * User interface representing an authenticated user
 */
export interface User {
  id: string;
  email: string;
  name: string;
}

/**
 * Authentication service interface
 */
export interface AuthService {
  /**
   * Validate a JWT token and return the user if valid
   * @param token JWT token to validate
   * @returns User object if token is valid, null otherwise
   */
  validateToken(token: string): Promise<User | null>;
  
  /**
   * Get the default user for development environments
   * @returns Default user object
   */
  getDefaultUser(): User;
}

/**
 * Stub implementation of the authentication service for development
 * This will be replaced with AWS Cognito implementation in production
 */
export class StubAuthService implements AuthService {
  /**
   * Validate a token (stub implementation always returns the default user)
   * @param token JWT token to validate
   * @returns Default user object
   */
  validateToken(token: string): Promise<User | null> {
    // During development, accept any token and return default user
    console.log('StubAuthService: Validating token (stub implementation)');
    return Promise.resolve(this.getDefaultUser());
  }

  /**
   * Get the default user for development
   * @returns Default user object
   */
  getDefaultUser(): User {
    return {
      id: DEFAULT_USER_ID, // Use constant for consistency
      email: 'default@childrens.harvard.edu',
      name: 'Default User'
    };
  }
}

/**
 * AWS Cognito implementation of the authentication service
 * This is a placeholder that will be implemented when integrating with Cognito
 */
export class CognitoAuthService implements AuthService {
  /**
   * Validate a JWT token using AWS Cognito
   * @param token JWT token to validate
   * @returns User object if token is valid, null otherwise
   */
  validateToken(token: string): Promise<User | null> {
    // This will be implemented when integrating with Cognito
    // For now, just return the default user
    console.log('CognitoAuthService: Validating token (not yet implemented)');
    return Promise.resolve(this.getDefaultUser());
  }

  /**
   * Get the default user for development
   * @returns Default user object
   */
  getDefaultUser(): User {
    return {
      id: DEFAULT_USER_ID, // Use constant for consistency
      email: 'default@childrens.harvard.edu',
      name: 'Default User'
    };
  }
}

/**
 * Factory function to get the appropriate auth service based on environment
 * @returns AuthService implementation
 */
export const getAuthService = (): AuthService => {
  if (process.env.USE_COGNITO === 'true') {
    console.log('Using CognitoAuthService');
    return new CognitoAuthService();
  }
  console.log('Using StubAuthService');
  return new StubAuthService();
};