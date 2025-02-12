/// <reference types="@testing-library/jest-dom" />
import { type RenderResult } from '@testing-library/react';
import { type ReactNode } from 'react';
import { type QueryClient } from '@tanstack/react-query';

// Test utilities
export interface TestRenderOptions {
  route?: string;
  initialEntries?: string[];
  queryClient?: QueryClient;
}

// Extend RenderResult type directly
export type TestRenderResult = RenderResult;

// Mock types
export interface MockToast {
  toast: jest.Mock;
  dismiss: jest.Mock;
  toasts: any[];
}

export interface MockResponse extends Response {
  json(): Promise<any>;
  text(): Promise<string>;
  blob(): Promise<Blob>;
  arrayBuffer(): Promise<ArrayBuffer>;
  formData(): Promise<FormData>;
}

export interface MockHeaders {
  append(name: string, value: string): void;
  delete(name: string): void;
  get(name: string): string | null;
  has(name: string): boolean;
  set(name: string, value: string): void;
  forEach(callback: (value: string, key: string) => void): void;
}

// Mock Smartsheet Context
export interface MockSmartsheetContext {
  currentSheetId: string;
  currentSessionId: string;
  setCurrentSheetId: jest.Mock;
  setCurrentSessionId: jest.Mock;
  clearSession: jest.Mock;
}

// Mock API Request
export type MockApiRequest = jest.Mock<Promise<Response>>;

// Mock Toast Hook
export type MockToastHook = jest.Mock<{
  toast: jest.Mock;
  dismiss: jest.Mock;
  toasts: any[];
}>;

// Declare global matchers from @testing-library/jest-dom
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toBeEnabled(): R;
      toHaveTextContent(text: string | RegExp): R;
      toBeVisible(): R;
      toHaveClass(className: string): R;
      toHaveStyle(css: Record<string, any>): R;
      toHaveAttribute(attr: string, value?: string): R;
      toHaveValue(value: string | string[] | number): R;
      toBeDisabled(): R;
      toBeChecked(): R;
      toBePartiallyChecked(): R;
      toHaveFocus(): R;
      toBeRequired(): R;
      toBeInvalid(): R;
      toBeValid(): R;
      toBeEmptyDOMElement(): R;
      toHaveDescription(text: string | RegExp): R;
      toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): R;
      toHaveErrorMessage(text: string | RegExp): R;
      toHaveFormValues(values: Record<string, any>): R;
      toBeEmpty(): R;
      toContainElement(element: HTMLElement | null): R;
      toContainHTML(html: string): R;
      toHaveAccessibleDescription(description?: string | RegExp): R;
      toHaveAccessibleName(name?: string | RegExp): R;
    }
  }
}
