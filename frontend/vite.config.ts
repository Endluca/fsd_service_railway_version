import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        // 开发环境使用本地后端，生产环境构建后不使用 proxy
        target: process.env.VITE_API_BASE_URL || 'http://localhost:3005',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
})