import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  // tsconfig memakai jsx: preserve (untuk Next.js) — tanpa ini oxc
  // vitest membiarkan JSX mentah dan import-analysis gagal parse .tsx.
  // (Vitest 5 memakai oxc, bukan esbuild — opsi esbuild diabaikan.)
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    include: [
      'src/lib/__tests__/**/*.test.ts',
      'src/app/api/**/*.test.ts',
      // Tes komponen presentasional (renderToStaticMarkup, tanpa jsdom).
      'src/components/__tests__/**/*.test.tsx',
    ],
    environment: 'node',
    // Integration test (mongodb-memory-server) boleh butuh waktu download binary.
    testTimeout: 180000,
  },
});
