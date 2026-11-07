import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  test: {
    include: ['src/lib/__tests__/**/*.test.ts', 'src/app/api/**/*.test.ts'],
    environment: 'node',
    // Integration test (mongodb-memory-server) boleh butuh waktu download binary.
    testTimeout: 180000,
  },
});
