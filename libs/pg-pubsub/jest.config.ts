/* eslint-disable */
module.exports = {
  displayName: 'pg-pubsub',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/pg-pubsub',
  testPathIgnorePatterns: ['integration', 'stress'],
  detectOpenHandles: true,
}
