import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    __BUILD__: JSON.stringify((process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7)),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        lang: 'pt-BR',
        name: 'Remédios',
        short_name: 'Remédios',
        description: 'Acompanhe seu tratamento e receba lembretes de cada dose',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F2F3F7',
        theme_color: '#F2F3F7',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
})
