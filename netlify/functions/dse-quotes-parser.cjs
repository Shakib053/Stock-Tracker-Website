const https = require('node:https')

const DSE_QUOTES_URL = 'https://dsebd.org/latest_share_price_scroll_l.php'
const REQUEST_TIMEOUT_MS = 20_000

const HEADER_MAP = {
  '#': null,
  'TRADING CODE': 'TRADING CODE',
  'LTP*': 'LTP*',
  HIGH: 'HIGH',
  LOW: 'LOW',
  'CLOSEP*': 'CLOSEP*',
  'YCP*': 'YCP*',
  CHANGE: 'CHANGE',
  TRADE: 'TRADE',
  'VALUE (MN)': 'VALUE (mn)',
  VOLUME: 'VOLUME',
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
}

function cleanCell(value) {
  return decodeHtml(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractMatches(value, pattern) {
  const matches = []
  let match = pattern.exec(value)

  while (match) {
    matches.push(match)
    match = pattern.exec(value)
  }

  return matches
}

function extractSharePriceTable(html) {
  const tableMatch = String(html ?? '').match(
    /<table[^>]*class=['"][^'"]*\bshares-table\b[^'"]*['"][^>]*>([\s\S]*?)<\/table>/i,
  )

  if (!tableMatch) {
    throw new Error('DSE share price table was not found.')
  }

  return tableMatch[1]
}

function parseDseQuotesHtml(html) {
  const table = extractSharePriceTable(html)
  const headerMatch = table.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i)

  if (!headerMatch) {
    throw new Error('DSE share price table headers were not found.')
  }

  const headers = extractMatches(headerMatch[1], /<th[^>]*>([\s\S]*?)<\/th>/gi)
    .map((match) => cleanCell(match[1]).toUpperCase())
    .map((header) => (Object.prototype.hasOwnProperty.call(HEADER_MAP, header) ? HEADER_MAP[header] : header))

  return extractMatches(table, /<tr[^>]*>([\s\S]*?)<\/tr>/gi)
    .map((rowMatch) => {
      const cells = extractMatches(rowMatch[1], /<td[^>]*>([\s\S]*?)<\/td>/gi).map((match) =>
        cleanCell(match[1]),
      )
      const row = {}

      headers.forEach((header, index) => {
        if (header) {
          row[header] = cells[index] ?? ''
        }
      })

      return row
    })
    .filter((row) => row['TRADING CODE'])
}

function fetchDseHtml() {
  return new Promise((resolve, reject) => {
    const request = https.get(
      DSE_QUOTES_URL,
      {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'stock-profit-tracker/1.0',
        },
        rejectUnauthorized: false,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (response) => {
        let html = ''

        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          html += chunk
        })
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`DSE returned status ${response.statusCode}.`))
            return
          }

          resolve(html)
        })
      },
    )

    request.on('timeout', () => {
      request.destroy(new Error('DSE request timed out.'))
    })
    request.on('error', reject)
  })
}

async function fetchHtmlWithFetch(fetchImpl) {
  const response = await fetchImpl(DSE_QUOTES_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'stock-profit-tracker/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`DSE returned status ${response.status}.`)
  }

  return response.text()
}

async function fetchDseQuotesFromOfficialSite(fetchImpl) {
  const html = fetchImpl ? await fetchHtmlWithFetch(fetchImpl) : await fetchDseHtml()
  const data = parseDseQuotesHtml(html)

  if (data.length === 0) {
    throw new Error('DSE share price table did not contain any quote rows.')
  }

  return data
}

module.exports = {
  DSE_QUOTES_URL,
  fetchDseQuotesFromOfficialSite,
  parseDseQuotesHtml,
}
