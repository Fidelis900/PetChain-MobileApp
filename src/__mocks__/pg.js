/* eslint-env jest */
const Pool = jest.fn().mockImplementation(() => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  connect: jest.fn(),
  end: jest.fn(),
  on: jest.fn(),
}));

module.exports = { Pool };
