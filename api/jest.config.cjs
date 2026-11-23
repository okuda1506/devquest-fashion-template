module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/api/src/**/*.test.ts'],
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/api/tsconfig.json' }] },
};
