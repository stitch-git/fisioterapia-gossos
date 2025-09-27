import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'


export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'skipWaiting',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        skipWaiting: true,       
        clientsClaim: true,
        // Configuración mejorada para cache busting
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              networkTimeoutSeconds: 3,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/version\.json/,
            handler: 'NetworkOnly' // Siempre verificar versión desde red
          }
        ]
      },
      // Service worker personalizado
      swDest: 'dist/sw.js',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Fisioterapia Gossos - Sistema de Reservas',
        short_name: 'FisioGossos',
        description: 'Sistema de reservas profesional para fisioterapia canina. Reserva citas, gestiona tus perros y accede a servicios de rehabilitación e hidroterapia.',
        start_url: '/?utm_source=homescreen&utm_medium=pwa',
        id: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        background_color: '#ffffff',
        theme_color: '#4a90a4',
        categories: ['health', 'lifestyle', 'productivity'],
        lang: 'es',
        dir: 'ltr',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any'
          }
        ],
        shortcuts: [
          {
            name: 'Nueva Reserva',
            short_name: 'Reservar',
            description: 'Crear una nueva reserva de cita',
            url: '/?shortcut=booking',
            icons: [
              {
                src: '/pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              }
            ]
          },
          {
            name: 'Mis Citas',
            short_name: 'Citas',
            description: 'Ver y gestionar mis citas',
            url: '/?shortcut=mybookings',
            icons: [
              {
                src: '/pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              }
            ]
          },
          {
            name: 'Mis Perros',
            short_name: 'Perros',
            description: 'Gestionar información de mis mascotas',
            url: '/?shortcut=mydogs',
            icons: [
              {
                src: '/pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              }
            ]
          }
        ],
        prefer_related_applications: false,
        edge_side_panel: {
          preferred_width: 400
        },
        launch_handler: {
          client_mode: 'focus-existing'
        },
        protocol_handlers: [
          {
            protocol: 'web+fisugoggos',
            url: '/?protocol=%s'
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    // 🚀 CONFIGURACIÓN MEJORADA PARA CACHE BUSTING
    rollupOptions: {
      output: {
        // Nombres con hash para JS y CSS
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name.split('.').at(-1)
          // CSS con hash
          if (extType === 'css') {
            return 'assets/[name]-[hash].[ext]'
          }
          // Imágenes y otros assets con hash
          return 'assets/[name]-[hash].[ext]'
        }
      }
    },
    // Generar manifest con hash
    cssCodeSplit: true,
    sourcemap: false // Para producción
  },
  // Configuración de cache mejorada
  define: {
      // Versión del package.json (leída dinámicamente)
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      // Timestamp del build
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      // Hash único del build
      __BUILD_VERSION__: JSON.stringify(Date.now().toString())
    }
   })