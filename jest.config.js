/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules[/\\\\](?!((react-native.*)|(@react-native.*)|(expo.*)|(uuid))[/\\\\])',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/core/**/*.ts',
    'src/data/**/*.ts',
    'src/graphql/**/*.ts',
    'src/ui/hooks/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 40,
      branches: 25,
      functions: 35,
      lines: 40,
    },
    'src/graphql/dto.ts': {
      statements: 70,
      functions: 70,
      lines: 70,
    },
    'src/core/oeeCalculator.ts': {
      statements: 80,
      branches: 70,
      functions: 100,
      lines: 80,
    },
    'src/core/qualityTrendsCalculator.ts': {
      statements: 80,
      functions: 100,
      lines: 80,
    },
    'src/data/migrations.ts': {
      statements: 80,
      functions: 90,
      lines: 80,
    },
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/', '/nhost/'],
};
