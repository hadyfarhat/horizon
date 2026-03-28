import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    proxy: {
      // Proxy OpenSky auth token requests to avoid CORS in development
      '/opensky-auth': {
        target:      'https://auth.opensky-network.org',
        changeOrigin: true,
        rewrite:     (path) => path.replace(/^\/opensky-auth/, ''),
      },
      // Proxy OpenSky API requests to avoid CORS in development
      '/opensky-api': {
        target:      'https://opensky-network.org',
        changeOrigin: true,
        rewrite:     (path) => path.replace(/^\/opensky-api/, ''),
      },
    },
  },
})
