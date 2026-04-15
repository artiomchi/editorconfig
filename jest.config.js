/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  clearMocks: true,
  moduleNameMapper: {
    // Allow importing TS source files with .js extension (ESM-style imports)
    '^(\\.\\.?/.*)\\.js$': '$1',
  },
};
