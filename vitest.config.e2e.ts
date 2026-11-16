import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Creates the test database once, before any test file runs.
    globalSetup: ['./test/global-setup.ts'],
    // Runs before each test file's imports: sets the environment the app reads at startup.
    setupFiles: ['./test/setup-env.ts'],
    // All files share one database, so they must not run at the same time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
