import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  path: string,
  data?: unknown | undefined,
  headers?: Record<string, string>
): Promise<Response> {
  // Get session ID from localStorage
  let sessionHeaders: Record<string, string> = {};
  try {
    const storedSession = localStorage.getItem('smartsheet_session');
    if (storedSession) {
      const session = JSON.parse(storedSession);
      if (session.sessionId) {
        sessionHeaders = { 'x-session-id': session.sessionId };
      }
    }
  } catch (error) {
    console.error('Error reading session from localStorage:', error);
  }

  const res = await fetch(path, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...sessionHeaders,
      ...headers
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey[0] as string;
    
    // Get session ID from localStorage
    let sessionHeaders: Record<string, string> = {};
    try {
      const storedSession = localStorage.getItem('smartsheet_session');
      if (storedSession) {
        const session = JSON.parse(storedSession);
        if (session.sessionId) {
          sessionHeaders = { 'x-session-id': session.sessionId };
        }
      }
    } catch (error) {
      console.error('Error reading session from localStorage:', error);
    }
    
    const res = await fetch(path, {
      credentials: "include",
      headers: sessionHeaders
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
