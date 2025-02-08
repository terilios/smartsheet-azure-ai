import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: "client", // Set the project root to the "client" directory so index.html is used from there
  server: {
    port: 5173, // Front-end dev server port
  },
  plugins: [react()],
});
