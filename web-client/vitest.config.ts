import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    exclude: [
      'node_modules/**',
      'tests/**', // Exclude Playwright tests
      'dist/**',
      'build/**',
      '.idea/**',
      '.git/**',
      '.cache/**'
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tenex/test-utils': path.resolve(__dirname, '../packages/test-utils/src'),
      '@tenex/types': path.resolve(__dirname, '../packages/types/src'),
      '@tenex/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});