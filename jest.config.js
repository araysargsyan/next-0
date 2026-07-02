const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

module.exports = async () => {
  // Resolve individual project configs with SWC compilation enabled
  const unitConfig = await createJestConfig({
    testEnvironment: 'node',
    testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts', '<rootDir>/src/**/*.spec.ts'],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1',
    },
    clearMocks: true,
  })();

  const e2eConfig = await createJestConfig({
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/**/*.e2e-spec.ts'],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1',
    },
    clearMocks: true,
  })();

  // Set the display names
  unitConfig.displayName = 'unit';
  e2eConfig.displayName = 'e2e';

  return {
    projects: [unitConfig, e2eConfig],
  };
};
