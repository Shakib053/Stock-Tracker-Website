import { getStore } from '@netlify/blobs'
import parser from './dse-quotes-parser.cjs'

const { fetchDseQuotesFromOfficialSite } = parser

const CACHE_SCHEMA_VERSION = 1
const CACHE_STORE_NAME = 'dse-market-data'
const CACHE_KEY = 'latest-quotes'
const MAX_RETRIES = 3
const SOURCE = 'dsebd.org'

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isValidQuoteData(data) {
  return Array.isArray(data) && data.length > 0 && data.every((row) => {
    return row && typeof row === 'object' && String(row['TRADING CODE'] ?? '').trim()
  })
}

function isValidCacheEnvelope(value) {
  return Boolean(
    value &&
      value.schemaVersion === CACHE_SCHEMA_VERSION &&
      typeof value.fetchedAt === 'string' &&
      !Number.isNaN(Date.parse(value.fetchedAt)) &&
      typeof value.source === 'string' &&
      isValidQuoteData(value.data),
  )
}

function buildResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
    body: JSON.stringify(body),
  }
}

function buildCachedPayload(envelope) {
  return {
    success: true,
    data: envelope.data,
    message: 'Showing cached DSE prices and stock symbols because live data is unavailable.',
    fetchedAt: envelope.fetchedAt,
    source: envelope.source,
    stale: true,
    cached: true,
  }
}

async function fetchWithRetries(fetchQuotes, wait, maxRetries) {
  let lastError = null

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const data = await fetchQuotes()

      if (!isValidQuoteData(data)) {
        throw new Error('DSE quote data was empty or invalid.')
      }

      return data
    } catch (error) {
      lastError = error

      if (attempt < maxRetries) {
        await wait(250 * 2 ** (attempt - 1))
      }
    }
  }

  throw lastError ?? new Error('Failed to fetch DSE quotes.')
}

export function createDseQuotesHandler({
  fetchQuotes = fetchDseQuotesFromOfficialSite,
  getCacheStore = () => getStore(CACHE_STORE_NAME),
  wait = sleep,
  maxRetries = MAX_RETRIES,
  now = () => new Date().toISOString(),
} = {}) {
  let memoryEnvelope = null

  return async function dseQuotesHandler() {
    try {
      const data = await fetchWithRetries(fetchQuotes, wait, maxRetries)
      const envelope = {
        schemaVersion: CACHE_SCHEMA_VERSION,
        data,
        fetchedAt: now(),
        source: SOURCE,
      }

      memoryEnvelope = envelope

      try {
        await getCacheStore().setJSON(CACHE_KEY, envelope)
      } catch (cacheWriteError) {
        console.error('Unable to persist DSE quotes to the durable cache.', cacheWriteError)
      }

      return buildResponse({
        success: true,
        data: envelope.data,
        message: '',
        fetchedAt: envelope.fetchedAt,
        source: envelope.source,
        stale: false,
        cached: false,
      })
    } catch (upstreamError) {
      console.error('DSE quotes proxy failed.', upstreamError)

      try {
        const durableEnvelope = await getCacheStore().get(CACHE_KEY, {
          type: 'json',
          consistency: 'strong',
        })

        if (isValidCacheEnvelope(durableEnvelope)) {
          memoryEnvelope = durableEnvelope
          return buildResponse(buildCachedPayload(durableEnvelope))
        }

        if (durableEnvelope != null) {
          console.error('The durable DSE quote cache was invalid and was ignored.')
        }
      } catch (cacheReadError) {
        console.error('Unable to read DSE quotes from the durable cache.', cacheReadError)
      }

      if (isValidCacheEnvelope(memoryEnvelope)) {
        return buildResponse(buildCachedPayload(memoryEnvelope))
      }

      return buildResponse(
        {
          success: false,
          data: [],
          message: 'Unable to fetch DSE quotes and no valid cached dataset is available.',
          fetchedAt: now(),
          stale: true,
          cached: false,
        },
        502,
      )
    }
  }
}

export const handler = createDseQuotesHandler()

export { CACHE_KEY, CACHE_SCHEMA_VERSION, CACHE_STORE_NAME, isValidCacheEnvelope, isValidQuoteData }
