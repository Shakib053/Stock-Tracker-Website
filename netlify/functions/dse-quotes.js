const { fetchDseQuotesFromOfficialSite } = require('./dse-quotes-parser.cjs')

const MAX_RETRIES = 3

let cache = {
  payload: null,
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function fetchUpstream() {
  let lastError = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await fetchDseQuotesFromOfficialSite()
    } catch (error) {
      lastError = error

      if (attempt < MAX_RETRIES) {
        await sleep(250 * 2 ** (attempt - 1))
      }
    }
  }

  throw lastError ?? new Error('Failed to fetch DSE quotes.')
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

exports.handler = async function handler() {
  try {
    const data = await fetchUpstream()
    const fetchedAt = new Date().toISOString()
    const payload = {
      success: true,
      data,
      message: '',
      fetchedAt,
      source: 'dsebd.org',
      stale: false,
      cached: false,
    }

    cache = {
      payload,
    }

    return buildResponse(payload)
  } catch (error) {
    console.error('DSE quotes proxy failed.', error)

    if (cache.payload) {
      return buildResponse({
        ...cache.payload,
        stale: true,
        cached: true,
        message: 'Serving cached DSE quotes because the upstream source is unavailable.',
      })
    }

    return buildResponse(
      {
        success: false,
        data: [],
        message: 'Unable to fetch DSE quotes.',
        fetchedAt: new Date().toISOString(),
        stale: true,
        cached: false,
      },
      502,
    )
  }
}
