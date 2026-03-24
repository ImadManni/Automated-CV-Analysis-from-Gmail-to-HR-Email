import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3004,
    strictPort: false,
    open: false,
    proxy: {
      '/api': { target: 'http://localhost:3005', changeOrigin: true },
      '/docs': { target: 'http://localhost:3005', changeOrigin: true },
      '/swagger-ui': { target: 'http://localhost:3005', changeOrigin: true },
    },
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
