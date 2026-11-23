import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
const options = { port: 5174, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' } };
export default defineConfig({
  plugins: [react()],
  server: options,
  preview: options,
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] },
});
