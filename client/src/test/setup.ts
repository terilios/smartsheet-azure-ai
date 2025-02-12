import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Add TextEncoder/TextDecoder to global
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock fetch
global.fetch = jest.fn();

// Mock Headers
class MockHeaders {
  private headers: Map<string, string>;

  constructor(init?: HeadersInit) {
    this.headers = new Map();
    if (init) {
      if (init instanceof MockHeaders) {
        this.headers = new Map(init.headers);
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.headers.set(key.toLowerCase(), value));
      } else {
        Object.entries(init).forEach(([key, value]) => this.headers.set(key.toLowerCase(), value));
      }
    }
  }

  append(name: string, value: string): void {
    this.headers.set(name.toLowerCase(), value);
  }

  delete(name: string): void {
    this.headers.delete(name.toLowerCase());
  }

  get(name: string): string | null {
    return this.headers.get(name.toLowerCase()) || null;
  }

  has(name: string): boolean {
    return this.headers.has(name.toLowerCase());
  }

  set(name: string, value: string): void {
    this.headers.set(name.toLowerCase(), value);
  }

  forEach(callback: (value: string, key: string) => void): void {
    this.headers.forEach((value, key) => callback(value, key));
  }
}

global.Headers = MockHeaders as any;

// Mock Response
class MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  body: any;
  bodyUsed: boolean;
  redirected: boolean;
  type: ResponseType;
  url: string;

  constructor(body: any, init: ResponseInit = {}) {
    this.ok = init.status ? init.status >= 200 && init.status < 300 : true;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new Headers(init.headers);
    this.body = body;
    this.bodyUsed = false;
    this.redirected = false;
    this.type = 'default';
    this.url = '';
  }

  json() {
    return Promise.resolve(this.body);
  }

  text() {
    return Promise.resolve(JSON.stringify(this.body));
  }

  blob() {
    return Promise.resolve(new Blob());
  }

  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(0));
  }

  formData() {
    return Promise.resolve(new FormData());
  }

  clone() {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }
}

global.Response = MockResponse as any;

// Mock setImmediate for waitForPromises
if (!global.setImmediate) {
  (global as any).setImmediate = (callback: Function) => setTimeout(callback, 0);
}

// Configure Jest DOM environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
