import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 默认代理到 M3 API (singan2_server.exe :8080)，避免 CORS 与跨端口问题。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 大文件上传（数十~数百 MB）需放宽超时，否则代理侧会重置连接
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        timeout: 600000,
        proxyTimeout: 600000
      },
      '/health': 'http://127.0.0.1:8080'
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: true,
    include: ['src/**/*.test.{js,jsx}'],
  }
})
