// Jest setup file for global test configuration
process.env.NODE_ENV = 'test';
process.env.STELLAR_NETWORK = 'testnet';
process.env.JWT_SECRET = 'test-secret-key';

// Suppress console errors in tests unless explicitly needed
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Mock timers for consistent testing
jest.useFakeTimers();
