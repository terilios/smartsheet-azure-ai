import React from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SmartsheetProvider } from '@/lib/smartsheet-context';
import { 
  type TestRenderOptions, 
  type MockSmartsheetContext,
  type MockResponse 
} from './types';

// Create a wrapper with all providers
export function createWrapper(queryClient?: QueryClient) {
  const client = queryClient || new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <SmartsheetProvider>
          {children}
        </SmartsheetProvider>
      </QueryClientProvider>
    );
  };
}

// Custom render function
export function renderWithProviders(
  ui: React.ReactElement,
  options: TestRenderOptions = {}
): RenderResult {
  const Wrapper = createWrapper(options.queryClient);
  return render(ui, { wrapper: Wrapper, ...options });
}

// Create mock response
export function createMockApiResponse(data: any, init: ResponseInit = {}): MockResponse {
  return {
    ok: init.status ? init.status >= 200 && init.status < 300 : true,
    status: init.status || 200,
    statusText: init.statusText || 'OK',
    headers: new Headers(init.headers),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    body: null,
    bodyUsed: false,
    redirected: false,
    type: 'default',
    url: '',
    clone: function() { return this; }
  } as MockResponse;
}

// Create mock toast
export function createMockToast() {
  return {
    toast: jest.fn(),
    dismiss: jest.fn(),
    toasts: []
  };
}

// Create mock smartsheet context
export function createMockSmartsheetContext(overrides = {}): MockSmartsheetContext {
  return {
    currentSheetId: 'test-sheet',
    currentSessionId: 'test-session',
    setCurrentSheetId: jest.fn(),
    setCurrentSessionId: jest.fn(),
    clearSession: jest.fn(),
    ...overrides
  };
}

// Wait for promises to resolve
export const waitForPromises = () => new Promise(resolve => setImmediate(resolve));

// Create mock error
export function createMockError(message: string) {
  const error = new Error(message);
  error.stack = `Error: ${message}\n    at Test (test.ts:1:1)`;
  return error;
}

// Create mock event
export function createMockEvent() {
  return {
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  };
}

// Create mock form data
export function createMockFormData(data: Record<string, string>) {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
}

// Create mock file
export function createMockFile(name: string, type: string, size: number) {
  return new File(['test'], name, { type });
}
