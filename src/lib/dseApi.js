const DSE_QUOTES_PROXY_URL = '/api/dse-quotes'
const DSE_QUOTES_DIRECT_URL = 'https://bdstock.org/v1/dse/latest'
const POLL_INTERVAL_MS = 60_000

export { POLL_INTERVAL_MS }

export function isDseMarketOpen(date = new Date()) {
  const bst = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }))
  const day = bst.getDay()
  const mins = bst.getHours() * 60 + bst.getMinutes()
  const open = 10 * 60
  const close = 14 * 60 + 30

  return day >= 0 && day <= 4 && mins >= open && mins <= close
}

function parseNumericField(value) {
  if (value == null || value === '' || value === '--') {
    return null
  }

  const normalized = String(value).replace(/,/g, '')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeQuoteRow(row) {
  const symbol = String(row['TRADING CODE'] ?? '').trim().toUpperCase()

  if (!symbol) {
    return null
  }

  return {
    symbol,
    ltp: parseNumericField(row['LTP*']),
    high: parseNumericField(row.HIGH),
    low: parseNumericField(row.LOW),
    close: parseNumericField(row['CLOSEP*']),
    ycp: parseNumericField(row['YCP*']),
    change: parseNumericField(row.CHANGE),
    volume: parseNumericField(row.VOLUME),
    tradeCount: parseNumericField(row.TRADE),
  }
}

export function buildQuotesMap(rows = []) {
  return rows.reduce((accumulator, row) => {
    const quote = normalizeQuoteRow(row)

    if (quote) {
      accumulator[quote.symbol] = quote
    }

    return accumulator
  }, {})
}

function isValidQuotesPayload(payload) {
  return Boolean(payload?.success && Array.isArray(payload.data))
}

async function fetchQuotesPayload(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`DSE quotes request failed with status ${response.status}.`)
  }

  const payload = await response.json()

  if (!isValidQuotesPayload(payload)) {
    throw new Error('DSE quotes response was not valid JSON market data.')
  }

  return payload
}

function getQuoteSourceUrls() {
  if (import.meta.env.DEV) {
    return [DSE_QUOTES_DIRECT_URL, DSE_QUOTES_PROXY_URL]
  }

  return [DSE_QUOTES_PROXY_URL, DSE_QUOTES_DIRECT_URL]
}

export async function fetchDseQuotes() {
  const urls = getQuoteSourceUrls()
  let lastError = null

  for (const url of urls) {
    try {
      const payload = await fetchQuotesPayload(url)
      const quotes = buildQuotesMap(payload.data ?? [])

      return {
        quotes,
        fetchedAt: payload.fetchedAt ?? new Date().toISOString(),
        stale: Boolean(payload.stale),
        source: url === DSE_QUOTES_PROXY_URL ? 'netlify-proxy' : 'bdstock.org',
      }
    } catch (error) {
      lastError = error
      console.warn(`DSE quote fetch failed for ${url}.`, error)
    }
  }

  throw lastError ?? new Error('Unable to fetch DSE quotes.')
}
