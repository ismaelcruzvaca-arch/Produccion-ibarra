// Stryker configuration for produccion-ibarra
// Mutation testing to validate test quality

/** @type {import('@stryker-mutator/api/core').StrykerOptions} */
module.exports = {
  packageManager: 'npm',
  plugins: ['@stryker-mutator/jest-runner'],
  testRunner: 'jest',
  jest: {
    config: require('./jest.config.js'),
    enableFindRelatedTests: true,
  },
  reporters: ['progress', 'html', 'clear-text'],
  htmlReporter: {
    fileName: 'reports/mutation/index.html',
  },
  mutate: [
    'src/core/**/*.ts',
    'src/data/migrations.ts',
    'src/graphql/dto.ts',
    'src/ui/hooks/useShiftClose.ts',
  ],
  coverageAnalysis: 'perTest',
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  tempDirName: 'stryker-tmp',
  cleanTempDir: true,
  concurrency: 4,
  timeoutMS: 30000,
};
