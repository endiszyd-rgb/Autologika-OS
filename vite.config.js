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
          if (modulePath.includes('/src/work-catalog-workshop-v3.js')) return 'work-catalog-v3'
          if (modulePath.includes('/src/work-catalog-workshop-v2.js')) return 'work-catalog-v2'
          if (modulePath.includes('/src/work-catalog-workshop-extra.js')) return 'work-catalog-extra'
          if (modulePath.includes('/src/work-catalog-expansion.js')) return 'work-catalog-expansion'
          if (modulePath.includes('/src/work-catalog-specialist.js') || modulePath.includes('/src/work-catalog-diagnostics.js')) return 'work-catalog-specialists'
        }
      }
    }
  }
})
