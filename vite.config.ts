import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const cursorSharedAssets = resolve(
  process.env.USERPROFILE || 'C:/Users/DELL',
  '.cursor/projects/c-Users-DELL-Desktop-screens-Automated-CV-Analysis-from-Gmail-to-HR-Email-IMADPCA/assets',
)

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3004,
    strictPort: true,
    open: false,
    fs: {
      allow: [projectRoot, cursorSharedAssets],
    },
    proxy: {
      '/api': { target: 'http://localhost:3005', changeOrigin: true },
      '/docs': { target: 'http://localhost:3005', changeOrigin: true },
      '/swagger-ui': { target: 'http://localhost:3005', changeOrigin: true },
    },
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
