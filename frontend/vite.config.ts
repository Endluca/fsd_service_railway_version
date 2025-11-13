import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: true,
    allowedHosts: [
      '.ngrok-free.dev',
      '.ngrok.app',
      '.trycloudflare.com',
    ],
    // ... existing code ...
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      }
    }
  }
})