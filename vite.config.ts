import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';
  // نسخة المعاينة (scripts/make_preview.py): مسارات نسبية + بلا Service Worker + ديمو مفروض
  const isPreview = process.env.VITE_PREVIEW === '1';
  const appBuildId = isBuild ? `v-${Date.now()}` : 'dev-live';
  const appBuiltAt = new Date().toISOString();

  const versionJsonPlugin: Plugin = {
    name: 'amasa-version-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId: appBuildId, builtAt: appBuiltAt }, null, 2),
      });
    },
  };

  return {
    base: isPreview ? './' : '/',
    define: {
      __APP_BUILD_ID__: JSON.stringify(appBuildId),
      __APP_BUILD_TIME__: JSON.stringify(appBuiltAt),
    },
    plugins: [
      react(),
      tailwindcss(),
      versionJsonPlugin,
      VitePWA({
        disable: isPreview,
        registerType: 'autoUpdate',
        manifestFilename: 'manifest.json',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'sw-push.js',
        ],
        manifest: {
          id: '/',
          name: 'AMASA RESORT',
          short_name: 'AMASA RESORT',
          description: 'منصة إدارة وحجوزات الشاليهات والاستراحات الفاخرة (الترف، البيلسان، رانس، حمران)',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui'],
          orientation: 'portrait-primary',
          dir: 'rtl',
          lang: 'ar',
          background_color: '#F7F3EC',
          theme_color: '#F7F3EC',
          categories: ['business', 'travel', 'lifestyle'],
          prefer_related_applications: false,
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          importScripts: ['/sw-push.js'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,webp,svg,woff,woff2}', 'manifest.json'],
          globIgnores: ['**/*.zip', '**/aistudio/**', 'version.json'],
          navigateFallbackDenylist: [
            /^\/__\//,
            /^\/api\//,
            /^\/download\//,
            /^\/uploads\//,
            /^\/version\.json/i,
            /\.zip$/i,
            /\.php$/i,
          ],
          runtimeCaching: [
            {
              urlPattern: /\/(version\.json|api\/version)/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin && request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'amasa-images-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 90,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'classic',
        },
      }),
    ],
    build: {
      sourcemap: false,
      minify: true,
      cssMinify: true,
      chunkSizeWarningLimit: 600,
      rolldownOptions: {
        output: {
          legalComments: 'none',
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /node_modules[\\/](react|react-dom|scheduler)/,
              },
              {
                name: 'vendor-firestore',
                test: /node_modules[\\/](@firebase[\\/]firestore|firebase[\\/]firestore)/,
              },
              {
                name: 'vendor-firebase',
                test: /node_modules[\\/](firebase|@firebase)/,
              },
              {
                name: 'vendor-icons',
                test: /node_modules[\\/]lucide-react/,
              },
              {
                name: 'vendor-motion',
                test: /node_modules[\\/](motion|framer-motion)/,
              },
              {
                name: 'app-data',
                test: /src[\\/]data[\\/]mock/,
              },
            ],
          },
        },
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'lucide-react',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'firebase/storage',
      ],
    },
    resolve: {
      dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
