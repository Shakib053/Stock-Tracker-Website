import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchDseQuotes, isDseMarketOpen, POLL_INTERVAL_MS } from '../lib/dseApi'

export function useDseQuotes({ enabled = true } = {}) {
  const [quotes, setQuotes] = useState({})
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isStale, setIsStale] = useState(false)
  const [marketOpen, setMarketOpen] = useState(isDseMarketOpen())
  const quotesRef = useRef({})

  const loadQuotes = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) {
      return
    }

    if (!silent) {
      setStatus((currentStatus) => (currentStatus === 'ready' ? 'refreshing' : 'loading'))
    }

    try {
      const result = await fetchDseQuotes()
      quotesRef.current = result.quotes
      setQuotes(result.quotes)
      setLastUpdated(result.fetchedAt)
      setIsStale(result.stale)
      setError('')
      setStatus('ready')
    } catch (nextError) {
      console.error('Failed to load DSE quotes.', nextError)
      setError('Live DSE prices are unavailable right now.')
      setIsStale(true)
      setStatus(quotesRef.current && Object.keys(quotesRef.current).length > 0 ? 'ready' : 'error')
    }
  }, [enabled])

  const refresh = useCallback(() => loadQuotes({ silent: false }), [loadQuotes])

  useEffect(() => {
    if (!enabled) {
      setQuotes({})
      setStatus('idle')
      setError('')
      setLastUpdated(null)
      setIsStale(false)
      return undefined
    }

    loadQuotes()

    const pollTimer = window.setInterval(() => {
      setMarketOpen(isDseMarketOpen())

      if (isDseMarketOpen()) {
        loadQuotes({ silent: true })
      }
    }, POLL_INTERVAL_MS)

    const marketTimer = window.setInterval(() => {
      setMarketOpen(isDseMarketOpen())
    }, 30_000)

    return () => {
      window.clearInterval(pollTimer)
      window.clearInterval(marketTimer)
    }
  }, [enabled, loadQuotes])

  return {
    quotes,
    status,
    error,
    lastUpdated,
    isStale,
    marketOpen,
    refresh,
  }
}
