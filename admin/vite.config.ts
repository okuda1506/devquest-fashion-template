import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const options = { port: 5175, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' } };
export default defineConfig({ plugins: [react()], server: options, preview: options });
