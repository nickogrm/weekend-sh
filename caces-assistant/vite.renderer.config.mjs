import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: 'renderer',
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'renderer') }
  },
  base: './',
  build: {
    outDir: '../out/renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
