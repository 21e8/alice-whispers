import { MockResponse } from "./src/__tests__/test-utils/index.test";

// Make this a module by adding an export
export {};

(global.fetch as any) = jest.fn(() => Promise.resolve(new MockResponse()));

// Mock timer functions globally
// global.clearInterval = jest.fn();
// global.clearTimeout = jest.fn();
// (global.setInterval as any) = jest.fn();
// (global.setTimeout as any) = jest.fn();

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Cleanup mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
