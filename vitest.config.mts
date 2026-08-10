import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite resolves the "@/*" alias from tsconfig natively; no plugin needed.
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/features/**/lib/**'],
      thresholds: {
        // Pure money and period logic is where money gets lost. See docs/06-CONVENTIONS.md §5.
        'src/lib/money/**': { branches: 90, functions: 95, lines: 95, statements: 95 },
      },
    },
  },
});
