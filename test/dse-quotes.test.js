import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CACHE_SCHEMA_VERSION,
  createDseQuotesHandler,
} from '../netlify/functions/dse-quotes.js'
import { buildQuotesMap } from '../src/lib/dseApi.js'
import { enrichStockWithQuote } from '../src/lib/stockMath.js'

const rows = [
  {
    'TRADING CODE': 'SQURPHARMA',
    'LTP*': '215.4',
    CHANGE: '1.2',
  },
]

const fetchedAt = '2026-07-11T10:00:00.000Z'

function responseBody(response) {
  return JSON.parse(response.body)
}

function createStore(initialValue = null) {
  let value = initialValue

  return {
    async get() {
      return value
    },
    async setJSON(_key, nextValue) {
      value = nextValue
    },
    value() {
      return value
    },
  }
}

test('returns live quotes and persists a versioned complete dataset', async () => {
  const store = createStore()
  const handler = createDseQuotesHandler({
    fetchQuotes: async () => rows,
    getCacheStore: () => store,
    now: () => fetchedAt,
  })

  const response = await handler()
  const body = responseBody(response)

  assert.equal(response.statusCode, 200)
  assert.equal(body.success, true)
  assert.equal(body.cached, false)
  assert.deepEqual(body.data, rows)
  assert.deepEqual(store.value(), {
    schemaVersion: CACHE_SCHEMA_VERSION,
    data: rows,
    fetchedAt,
    source: 'dsebd.org',
  })
})

test('returns durable cached symbols and numeric LTP when upstream fails', async () => {
  const store = createStore({
    schemaVersion: CACHE_SCHEMA_VERSION,
    data: rows,
    fetchedAt,
    source: 'dsebd.org',
  })
  const handler = createDseQuotesHandler({
    fetchQuotes: async () => {
      throw new Error('upstream unavailable')
    },
    getCacheStore: () => store,
    maxRetries: 1,
  })

  const response = await handler()
  const body = responseBody(response)
  const quotes = buildQuotesMap(body.data)

  assert.equal(response.statusCode, 200)
  assert.equal(body.success, true)
  assert.equal(body.cached, true)
  assert.equal(body.stale, true)
  assert.equal(body.fetchedAt, fetchedAt)
  assert.deepEqual(Object.keys(quotes), ['SQURPHARMA'])
  assert.equal(quotes.SQURPHARMA.ltp, 215.4)
})

test('a cache write failure does not block a successful live response', async () => {
  const handler = createDseQuotesHandler({
    fetchQuotes: async () => rows,
    getCacheStore: () => ({
      async setJSON() {
        throw new Error('write failed')
      },
    }),
    now: () => fetchedAt,
  })

  const response = await handler()

  assert.equal(response.statusCode, 200)
  assert.equal(responseBody(response).cached, false)
})

test('rejects corrupt durable data and returns 502 without a warm cache', async () => {
  const handler = createDseQuotesHandler({
    fetchQuotes: async () => {
      throw new Error('upstream unavailable')
    },
    getCacheStore: () => createStore({ schemaVersion: 999, data: rows }),
    maxRetries: 1,
    now: () => fetchedAt,
  })

  const response = await handler()
  const body = responseBody(response)

  assert.equal(response.statusCode, 502)
  assert.equal(body.success, false)
  assert.deepEqual(body.data, [])
})

test('uses the warm cache if durable cache reading fails', async () => {
  let upstreamAvailable = true
  const handler = createDseQuotesHandler({
    fetchQuotes: async () => {
      if (!upstreamAvailable) {
        throw new Error('upstream unavailable')
      }
      return rows
    },
    getCacheStore: () => ({
      async setJSON() {},
      async get() {
        throw new Error('read failed')
      },
    }),
    maxRetries: 1,
    now: () => fetchedAt,
  })

  await handler()
  upstreamAvailable = false
  const response = await handler()

  assert.equal(response.statusCode, 200)
  assert.equal(responseBody(response).cached, true)
})

test('portfolio lastQuote remains the final fallback', () => {
  const stock = enrichStockWithQuote(
    { symbol: 'RENATA', lastQuote: 680, buyingPrice: 650, quantity: 2 },
    {},
  )

  assert.equal(stock.ltp, 680)
  assert.equal(stock.quoteSource, 'cached')
})

test('shared stale quotes are labeled cached while still supplying LTP', () => {
  const stock = enrichStockWithQuote(
    { symbol: 'SQURPHARMA', buyingPrice: 200, quantity: 2 },
    buildQuotesMap(rows),
    { quotesAreStale: true },
  )

  assert.equal(stock.ltp, 215.4)
  assert.equal(stock.quoteSource, 'cached')
})
