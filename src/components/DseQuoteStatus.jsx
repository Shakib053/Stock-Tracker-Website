import { formatDateTime } from '../lib/formatters'

function DseQuoteStatus({
  status,
  error,
  lastUpdated,
  isStale,
  marketOpen,
  quoteCount,
  onRefresh,
}) {
  const isLoading = status === 'loading' || status === 'refreshing'
  const quotesReady = status === 'ready' && quoteCount > 0

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/40 px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">DSE Live Prices</p>
          <p className="mt-1 text-sm text-slate-400">
            {marketOpen
              ? 'Market is open. Prices refresh about every minute.'
              : 'Market is closed. Showing the latest available DSE prices.'}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Last updated: {formatDateTime(lastUpdated)}
            {quotesReady ? (
              <span className="ml-2 text-slate-400">{quoteCount} DSE symbols loaded</span>
            ) : null}
            {isStale ? (
              <span className="ml-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-semibold uppercase tracking-wide text-amber-200">
                Stale
              </span>
            ) : null}
          </p>
          {error ? <p className="mt-2 text-sm text-amber-200">{error}</p> : null}
          {!error && status === 'ready' && quoteCount === 0 ? (
            <p className="mt-2 text-sm text-amber-200">
              DSE prices loaded, but no symbols were returned. Click Refresh Prices.
            </p>
          ) : null}
          {!error && status === 'error' ? (
            <p className="mt-2 text-sm text-amber-200">
              Could not reach DSE data on localhost. Restart with `npm run dev` and click Refresh
              Prices.
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="action-button self-start rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Refreshing...' : 'Refresh Prices'}
        </button>
      </div>
    </section>
  )
}

export default DseQuoteStatus
