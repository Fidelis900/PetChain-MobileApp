export const SeverityLevel = {
  fatal: 'fatal',
  error: 'error',
  warning: 'warning',
  info: 'info',
  debug: 'debug',
};

export const init = jest.fn();
export const captureException = jest.fn();
export const captureMessage = jest.fn();
export const withScope = jest.fn((callback) => callback({ setExtras: jest.fn() }));
export const setUser = jest.fn();
export const addBreadcrumb = jest.fn();

export default {
  init,
  captureException,
  captureMessage,
  withScope,
  setUser,
  addBreadcrumb,
};
