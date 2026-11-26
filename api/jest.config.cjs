module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/api/test/**/*.test.ts', '<rootDir>/api/src/**/*.spec.ts'],
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/api/tsconfig.json' }] },
};
