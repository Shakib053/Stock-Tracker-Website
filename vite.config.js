import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/dse-quotes': {
        target: 'https://bdstock.org',
        changeOrigin: true,
        rewrite: () => '/v1/dse/latest',
      },
    },
  },
  preview: {
    proxy: {
      '/api/dse-quotes': {
        target: 'https://bdstock.org',
        changeOrigin: true,
        rewrite: () => '/v1/dse/latest',
      },
    },
  },
})
