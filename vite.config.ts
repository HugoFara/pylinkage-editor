import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Vendor chunks. Rollup's object form also pulled each package's own
// dependencies in; Rolldown only takes a function, so they are listed.
const VENDOR_CHUNKS: Record<string, string[]> = {
  'vendor-react': ['react', 'react-dom', 'scheduler'],
  'vendor-konva': ['konva', 'react-konva', 'react-reconciler', 'its-fine'],
  'vendor-state': ['zustand', 'zundo', '@tanstack/react-query', '@tanstack/query-core'],
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // The Pyodide worker imports the runtime from the CDN with a dynamic import()
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const pkg = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//)?.[1]
          if (!pkg) return undefined
          return Object.keys(VENDOR_CHUNKS).find((chunk) => VENDOR_CHUNKS[chunk].includes(pkg))
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
