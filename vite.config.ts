import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

// base: './' 로 두어 웹(GitHub Pages 하위 경로), Electron(app://), Capacitor(Android) 모두에서
// 같은 빌드 결과물이 동작하도록 한다.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 4000,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
