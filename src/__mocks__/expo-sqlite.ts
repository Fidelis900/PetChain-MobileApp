const mockResultSet = {
  insertId: 1,
  rowsAffected: 1,
  rows: {
    length: 0,
    item: () => null,
    _array: [],
  },
};

const mockTx = {
  executeSql: jest.fn((sql, params, success, _error) => {
    if (success) success(mockTx, mockResultSet);
    return mockTx;
  }),
};

const mockDb = {
  execAsync: jest.fn(() => Promise.resolve()),
  runAsync: jest.fn(() => Promise.resolve({ changes: 1, lastInsertRowId: 1 })),
  getFirstAsync: jest.fn(() => Promise.resolve(null)),
  getAllAsync: jest.fn(() => Promise.resolve([])),
  withTransactionAsync: jest.fn((callback) => callback()),
  transaction: jest.fn((callback) => {
    callback(mockTx);
  }),
};

export const openDatabase = jest.fn(() => mockDb);
export const openDatabaseSync = jest.fn(() => mockDb);
