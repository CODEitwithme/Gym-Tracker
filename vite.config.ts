import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/motion')) {
            return 'vendor-motion'
          }
          if (id.includes('node_modules/dexie')) {
            return 'vendor-dexie'
          }
          if (
            id.includes('node_modules/@reduxjs') ||
            id.includes('node_modules/react-redux')
          ) {
            return 'vendor-redux'
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons'
          }
        },
      },
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
})
