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
      statements: 14,
      branches: 10,
      functions: 11,
      lines: 14,
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
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    '/nhost/',
    // UI component tests requieren modulos nativos (react-native-paper, vector-icons, etc.)
    // Se ejecutan en piso con la app real, no en Jest
    '/ui/components/',
    '/ui/components/organisms/',
    '/ui/components/atoms/',
    '/ui/hooks/__tests__/useAlert',
    '/ui/hooks/__tests__/useUnacknowledged',
    '/hooks/__tests__/useAlert',
    '/hooks/__tests__/useUnacknowledged',
    '/hooks/__tests__/gatewayStore',
    '/hooks/__tests__/useGateway',
    '/app/__tests__/',
    // Tests de repositorios legacy con modelo de calidad anterior
    '/repositories/__tests__/useQualityInspectionsRepository',
    '/repositories/__tests__/useOeeEventsRepository',
  ],
};
