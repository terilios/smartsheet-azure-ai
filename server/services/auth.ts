import { Request, Response } from "express";

/**
 * User interface representing an authenticated user.
 */
export interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * Stub authentication service for development.
 * This service returns a fixed default user based on the existing database entry.
 * The default user has the following properties:
 *   id: "00000000-0000-0000-0000-000000000000"
 *   email: "default@childrens.harvard.edu"
 *   name: "Default User"
 */
export class StubAuthService {
  async getUserFromToken(token: string | null): Promise<User> {
    // In development, ignore the token and always return the default user from the database.
    return {
      id: "00000000-0000-0000-0000-000000000000",
      name: "Default User",
      email: "default@childrens.harvard.edu"
    };
  }

  async validateToken(token: string): Promise<User> {
    // For development, simply return the default user.
    return this.getUserFromToken(null);
  }
  
  getDefaultUser(): User {
    return {
      id: "00000000-0000-0000-0000-000000000000",
      name: "Default User",
      email: "default@childrens.harvard.edu"
    };
  }
}

export const authService = new StubAuthService();
