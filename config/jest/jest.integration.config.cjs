const base = require('./jest.base.cjs');

module.exports = {
  ...base,
  displayName: 'integration',
  roots: ['<rootDir>/tests/integration/postgres'],
  testMatch: ['<rootDir>/tests/integration/postgres/**/*.test.ts'],
  testTimeout: 30000,
  passWithNoTests: true,
};
