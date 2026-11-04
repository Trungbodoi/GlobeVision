import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/GlobeVision/',
  build: {
    manifest: 'build-manifest.json',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('/node_modules/three/')) {
            return 'three-vendor';
          }
          if (
            normalized.includes('/node_modules/globe.gl/') ||
            normalized.includes('/node_modules/three-globe/')
          ) {
            return 'globe-vendor';
          }
        },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
})
