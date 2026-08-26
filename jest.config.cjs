const base = require('./config/jest/jest.base.cjs');

module.exports = {
  ...base,
  displayName: 'unit',
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/*.test.ts'],
};
