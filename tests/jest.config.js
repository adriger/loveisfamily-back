'use strict';

module.exports = {
  testEnvironment: 'node',
  testTimeout: 10000,
  testMatch: [
    '**/unit/**/*.test.js',
    '**/integration/**/*.test.js',
    '**/load-tests/**/*.test.js',
  ],
  setupFilesAfterFramework: ['./test-setup.js'],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 80,
      functions: 88,
      lines: 85,
    },
  },
  collectCoverageFrom: [
    '../agent-01/functions/**/*.js',
    '../agent-01/utils/**/*.js',
    '../agent-02/*.js',
    '../agent-03/*.js',
    '../agent-04/*.js',
    '!**/node_modules/**',
    '!**/*.test.js',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: './coverage',
  verbose: true,
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/unit/**/*.test.js'],
      testEnvironment: 'node',
      testTimeout: 5000,
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/integration/**/*.test.js'],
      testEnvironment: 'node',
      testTimeout: 30000,
      globalSetup: './test-setup.js',
    },
    {
      displayName: 'load',
      testMatch: ['<rootDir>/load-tests/**/*.test.js'],
      testEnvironment: 'node',
      testTimeout: 60000,
    },
  ],
};
