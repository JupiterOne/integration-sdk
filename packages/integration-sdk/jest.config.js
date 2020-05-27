module.exports = {
  preset: 'ts-jest',
  setupFilesAfterEnv: ['./jest.setup.ts'],
  clearMocks: true,
  restoreMocks: true,
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/test/**/*.test.ts',
    '<rootDir>/maintenance-jobs/**/*.test.ts',
    '!**/*.bak/*',
  ],
  testPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/node_modules/'],
  collectCoverage: false,
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  testEnvironment: 'node',
};
