import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import shadcnPlugin from '@replit/vite-plugin-shadcn-theme-json';

export default defineConfig({
  root: "client", // Set the project root to the "client" directory so index.html is used from there
  server: {
    port: 5173, // Front-end dev server port
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  plugins: [
    react(),
    shadcnPlugin({
      themeJsonPath: path.resolve(__dirname, './theme.json'),
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared')
    }
  }
});
