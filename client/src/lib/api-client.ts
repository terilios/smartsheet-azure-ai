/**
 * API client for making authenticated requests to the backend
 */

import { useAuth } from './auth-context';

/**
 * API client options
 */
interface ApiClientOptions {
  baseUrl?: string;
}

/**
 * Hook to use the API client
 * 
 * This hook provides methods for making authenticated API requests.
 * It automatically includes the authentication token in the request headers.
 * 
 * @param options API client options
 * @returns API client methods
 */
export const useApiClient = (options: ApiClientOptions = {}) => {
  const { token } = useAuth();
  const baseUrl = options.baseUrl || '';
  
  /**
   * Make an authenticated fetch request
   * 
   * @param url Request URL
   * @param options Request options
   * @returns Response promise
   */
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };
    
    const response = await fetch(`${baseUrl}${url}`, {
      ...options,
      headers
    });
    
    if (!response.ok) {
      // Try to parse error response
      try {
        const error = await response.json();
        throw new Error(error.message || error.error || 'API request failed');
      } catch (e) {
        // If parsing fails, throw generic error with status
        throw new Error(`API request failed with status ${response.status}`);
      }
    }
    
    // For 204 No Content responses, return empty object
    if (response.status === 204) {
      return {};
    }
    
    return response.json();
  };
  
  return {
    /**
     * Make a GET request
     * @param url Request URL
     * @param options Request options
     * @returns Response promise
     */
    get: <T = any>(url: string, options: RequestInit = {}): Promise<T> => 
      fetchWithAuth(url, { ...options, method: 'GET' }),
    
    /**
     * Make a POST request
     * @param url Request URL
     * @param data Request body
     * @param options Request options
     * @returns Response promise
     */
    post: <T = any>(url: string, data: any, options: RequestInit = {}): Promise<T> => 
      fetchWithAuth(url, {
        ...options,
        method: 'POST',
        body: JSON.stringify(data)
      }),
    
    /**
     * Make a PUT request
     * @param url Request URL
     * @param data Request body
     * @param options Request options
     * @returns Response promise
     */
    put: <T = any>(url: string, data: any, options: RequestInit = {}): Promise<T> => 
      fetchWithAuth(url, {
        ...options,
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    
    /**
     * Make a PATCH request
     * @param url Request URL
     * @param data Request body
     * @param options Request options
     * @returns Response promise
     */
    patch: <T = any>(url: string, data: any, options: RequestInit = {}): Promise<T> => 
      fetchWithAuth(url, {
        ...options,
        method: 'PATCH',
        body: JSON.stringify(data)
      }),
    
    /**
     * Make a DELETE request
     * @param url Request URL
     * @param options Request options
     * @returns Response promise
     */
    delete: <T = any>(url: string, options: RequestInit = {}): Promise<T> => 
      fetchWithAuth(url, { ...options, method: 'DELETE' }),
  };
};