import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { polierServiceWorker } from './pwa/swPlugin';

export default defineConfig({
  // relative Pfade: die App läuft an der Wurzel einer (Sub-)Domain ebenso wie in einem Unterordner
  base: './',
  plugins: [react(), polierServiceWorker()],
  server: { port: 5173, host: true },
  test: { environment: 'node' },
} as any);
