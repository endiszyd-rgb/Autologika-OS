import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from './package.json' with { type: 'json' }

export default defineConfig({
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version) },
  plugins: [
    react(),
    {name:'local-mobile-ocr',generateBundle(){
      for(const [name,source] of [
        ['worker.min.js','node_modules/tesseract.js/dist/worker.min.js'],
        ['tesseract-core-lstm.wasm.js','node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js'],
        ['pol.traineddata.gz','node_modules/@tesseract.js-data/pol/4.0.0/pol.traineddata.gz']
      ])this.emitFile({type:'asset',fileName:`ocr/${name}`,source:fs.readFileSync(source)})
    }},
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['brand/autologika-logo.png', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'AutoLogika OS',
        short_name: 'AutoLogika',
        description: 'System operacyjny warsztatu samochodowego AutoLogika',
        start_url: './',
        scope: './',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'portrait',
        background_color: '#080a09',
        theme_color: '#0b0f0c',
        lang: 'pl',
        categories: ['business', 'productivity', 'automotive'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores:['ocr/**'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'autologika-vehicle-photos-v1',
              expiration: {maxEntries: 250, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true},
              cacheableResponse: {statuses: [0, 200]}
            }
          },
          {
            urlPattern: /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'autologika-vehicle-photos-v1',
              expiration: {maxEntries: 250, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true},
              cacheableResponse: {statuses: [0, 200]}
            }
          }
        ],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
      }
    })
  ],
  base: './',
  build: {
    commonjsOptions:{include:[/node_modules/,/shared/]},
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
