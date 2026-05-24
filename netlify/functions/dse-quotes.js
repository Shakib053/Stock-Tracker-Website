const UPSTREAM_URL = 'https://bdstock.org/v1/dse/latest'
const CACHE_TTL_MS = 45_000
const MAX_RETRIES = 3

let cache = {
  payload: null,
  expiresAt: 0,
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
      const response = await fetch(UPSTREAM_URL, {
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Upstream returned status ${response.status}.`)
      }

      const payload = await response.json()

      if (!payload?.success) {
        throw new Error(payload?.message || 'Upstream response was not successful.')
      }

      return payload
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
      'Cache-Control': 'public, max-age=30',
    },
    body: JSON.stringify(body),
  }
}

exports.handler = async function handler() {
  const now = Date.now()

  if (cache.payload && cache.expiresAt > now) {
    return buildResponse({
      ...cache.payload,
      stale: false,
      cached: true,
    })
  }

  try {
    const upstream = await fetchUpstream()
    const fetchedAt = new Date().toISOString()
    const payload = {
      success: true,
      data: upstream.data ?? [],
      message: upstream.message ?? '',
      fetchedAt,
      source: 'bdstock.org',
      stale: false,
      cached: false,
    }

    cache = {
      payload,
      expiresAt: now + CACHE_TTL_MS,
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
