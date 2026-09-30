import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  // The built dashboard is served from /admin by the bot's Express server,
  // so asset URLs must be prefixed to match. Without this, index.html
  // requests /assets/* which Express does not serve and the page is blank.
  base: '/admin/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});