import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Update the proxy configuration so that /api requests (e.g. /api/sessions)
// are correctly forwarded to the backend server on the expected port.
// Be sure the backend server is running on port 3000 (or adjust as needed).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
