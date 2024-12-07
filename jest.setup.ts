// Make this a module by adding an export
export {};

class MockResponse implements Response {
  readonly headers: Headers;
  readonly ok: boolean;
  readonly redirected: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly type: "basic" | "cors" | "default" | "error" | "opaque" | "opaqueredirect";
  readonly url: string;
  readonly body: ReadableStream | null;
  readonly bodyUsed: boolean;

  constructor(private data: any = {}) {
    this.headers = new Headers();
    this.ok = true;
    this.redirected = false;
    this.status = 200;
    this.statusText = 'OK';
    this.type = 'basic';
    this.url = '';
    this.body = null;
    this.bodyUsed = false;
  }

  json() { return Promise.resolve(this.data); }
  text() { return Promise.resolve(''); }
  blob() { return Promise.resolve(new Blob([])); }
  arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
  formData() { return Promise.resolve(new FormData()); }
  clone(): Response { return new MockResponse(this.data); }
}

(global.fetch as any) = jest.fn(() => Promise.resolve(new MockResponse()));

// Mock timer functions globally
global.clearInterval = jest.fn();
global.clearTimeout = jest.fn();
(global.setInterval as any) = jest.fn();
(global.setTimeout as any) = jest.fn();

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Cleanup mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
