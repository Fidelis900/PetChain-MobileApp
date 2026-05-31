/**
 * Jest mock for @stellar/stellar-sdk.
 * Re-exports the real CJS module so Horizon.Server is available as a constructor
 * in the ts-jest (CommonJS) test environment.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sdk = require('@stellar/stellar-sdk');
module.exports = sdk;
