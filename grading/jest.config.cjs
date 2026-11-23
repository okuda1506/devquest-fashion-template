/* global module, require */
/* eslint-disable @typescript-eslint/no-require-imports */
module.exports = {
  ...require('../api/jest.config.cjs'),
  testMatch: ['<rootDir>/grading/*.api.test.ts'],
};
