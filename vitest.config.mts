import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// ".mts" = an ES module, which is what Vite expects (the old vitest.config.ts printed a warning on every run).
export default defineConfig({
  // "@/..." means "src/...", the same alias as in tsconfig.json.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
