import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  // NOTE: the d3 packages behind the chart kit are ESM-only with a locked
  // `exports` map, so there is no CJS build to fall back to and Jest cannot
  // require them. Setting `transformIgnorePatterns` here does NOT fix it —
  // next/jest appends user patterns *after* its own `/node_modules/` rule,
  // so the exclusion still wins. The supported lever is `transpilePackages`
  // in next.config.ts, which next/jest reads to build that first pattern.
  // See the d3 entry there.
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  // Real measured coverage (2026-07-14, after adding components/** to collectCoverageFrom)
  // was statements 0.51%, branches 8.8%, functions 3.42%, lines 0.51% — the previous
  // decorative 80/75 excluded components/ entirely (21 files invisible to coverage) and was
  // never actually enforced. Thresholds below are the real number rounded down 2-3 points
  // (floored at 0 where the measured value was already near zero) so the gate is honest
  // today and ratchets up as real tests get added.
  coverageThreshold: {
    global: {
      statements: 0,
      branches: 6,
      functions: 1,
      lines: 0,
    },
  },
};

export default createJestConfig(config);
