import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { fetchDseQuotesFromOfficialSite } = require('./netlify/functions/dse-quotes-parser.cjs')

async function handleDseQuotesRequest(request, response) {
  if (request.method !== 'GET') {
    response.statusCode = 405
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ success: false, data: [], message: 'Method not allowed.' }))
    return
  }

  try {
    const data = await fetchDseQuotesFromOfficialSite()
    response.statusCode = 200
    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Cache-Control', 'no-store')
    response.end(
      JSON.stringify({
        success: true,
        data,
        message: '',
        fetchedAt: new Date().toISOString(),
        source: 'dsebd.org',
        stale: false,
        cached: false,
      }),
    )
  } catch (error) {
    response.statusCode = 502
    response.setHeader('Content-Type', 'application/json')
    response.end(
      JSON.stringify({
        success: false,
        data: [],
        message: error instanceof Error ? error.message : 'Unable to fetch DSE quotes.',
        fetchedAt: new Date().toISOString(),
        stale: true,
        cached: false,
      }),
    )
  }
}

function dseQuotesMiddleware() {
  return {
    name: 'dse-quotes-middleware',
    configureServer(server) {
      server.middlewares.use('/api/dse-quotes', handleDseQuotesRequest)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/dse-quotes', handleDseQuotesRequest)
    },
  }
}

export default defineConfig({
  plugins: [react(), dseQuotesMiddleware()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/firebase/') || id.includes('/@firebase/')) {
              return 'firebase'
            }

            if (id.includes('/react/') || id.includes('/react-dom/')) {
              return 'react'
            }

            return 'vendor'
          }

          return undefined
        },
      },
    },
  },
})
