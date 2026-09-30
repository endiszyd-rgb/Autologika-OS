import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const modulePath = id.replaceAll('\\', '/')
          if (modulePath.includes('/node_modules/react/') || modulePath.includes('/node_modules/react-dom/') || modulePath.includes('/node_modules/scheduler/')) return 'react-runtime'
          if (modulePath.includes('/src/vehicle-catalog.js')) return 'vehicle-catalog'
          if (modulePath.includes('/src/work-catalog') || modulePath.includes('/src/work-procedures.js')) return 'work-catalog'
        }
      }
    }
  }
})
