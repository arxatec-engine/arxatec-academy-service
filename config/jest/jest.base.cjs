const path = require('node:path');

const rootDir = path.resolve(__dirname, '../..');

module.exports = {
  rootDir,
  testEnvironment: 'node',
  clearMocks: true,
  restoreMocks: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      {
        jsc: {
          target: 'es2022',
          parser: { syntax: 'typescript', decorators: false },
        },
        module: { type: 'commonjs' },
      },
    ],
  },
};
