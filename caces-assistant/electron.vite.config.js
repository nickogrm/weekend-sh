import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'main/index.js') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'main/preload.js') }
      }
    }
  },
  renderer: {
    root: 'renderer',
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'renderer/index.html') }
      }
    },
    plugins: [react()],
    resolve: {
      alias: { '@': resolve(__dirname, 'renderer') }
    }
  }
})
