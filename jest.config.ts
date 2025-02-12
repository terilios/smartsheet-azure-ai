import type { JestConfigWithTsJest } from 'ts-jest';
import { defaults as tsjPreset } from 'ts-jest/presets';
import { resolve } from 'path';

const config: JestConfigWithTsJest = {
  ...tsjPreset,
  rootDir: resolve(__dirname),
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  setupFilesAfterEnv: [
    '@testing-library/jest-dom',
    '<rootDir>/client/src/test/setup.ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@testing-library/(.*)$': '<rootDir>/node_modules/@testing-library/$1'
  },
  modulePaths: ['<rootDir>/client/src'],
  transform: {
    '^.+\\.(t|j)sx?$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
        ['@babel/preset-react', { runtime: 'automatic' }]
      ],
      plugins: [
        ['@babel/plugin-transform-runtime', { regenerator: true }]
      ]
    }]
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(react-markdown|vfile|vfile-message|unist-.*|unified|bail|is-plain-obj|trough|remark-.*|mdast-util-.*|micromark.*|decode-named-character-reference|character-entities|property-information|hast-util-whitespace|space-separated-tokens|comma-separated-tokens|pretty-bytes|trim-lines|devlop)/)'
  ],
  testMatch: [
    '<rootDir>/**/*.test.ts',
    '<rootDir>/**/*.test.tsx',
  ],
  collectCoverageFrom: [
    'client/src/**/*.{ts,tsx}',
    'server/**/*.ts',
    '!**/node_modules/**',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  globals: {
    'ts-jest': {
      isolatedModules: true,
      tsconfig: 'tsconfig.json'
    },
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  verbose: true,
  testTimeout: 10000,
  // Configure different test environments based on file patterns
  projects: [
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/client/**/*.test.{ts,tsx}'],
      setupFilesAfterEnv: [
        '@testing-library/jest-dom',
        '<rootDir>/client/src/test/setup.ts'
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/client/src/$1',
        '^@shared/(.*)$': '<rootDir>/shared/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '^@testing-library/(.*)$': '<rootDir>/node_modules/@testing-library/$1'
      },
      transformIgnorePatterns: [
        '/node_modules/(?!(react-markdown|vfile|vfile-message|unist-.*|unified|bail|is-plain-obj|trough|remark-.*|mdast-util-.*|micromark.*|decode-named-character-reference|character-entities|property-information|hast-util-whitespace|space-separated-tokens|comma-separated-tokens|pretty-bytes|trim-lines|devlop)/)'
      ],
      transform: {
        '^.+\\.(t|j)sx?$': ['babel-jest', {
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }],
            '@babel/preset-typescript',
            ['@babel/preset-react', { runtime: 'automatic' }]
          ],
          plugins: [
            ['@babel/plugin-transform-runtime', { regenerator: true }]
          ]
        }]
      }
    },
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/server/**/*.test.ts'],
      setupFiles: ['<rootDir>/jest.server.setup.ts'],
      transform: {
        '^.+\\.tsx?$': ['babel-jest', {
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }],
            '@babel/preset-typescript'
          ]
        }]
      }
    },
  ],
  // Add test environment configuration
  testEnvironmentOptions: {
    url: 'http://localhost',
    customExportConditions: [''],
  },
}

export default config;
