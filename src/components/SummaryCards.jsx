import { formatCurrency, getAmountTone } from '../lib/formatters'

const CARD_CONFIG = [
  {
    key: 'totalStocks',
    label: 'Total Stocks',
    format: (value) => value,
    accent: 'from-sky-500/20 to-cyan-400/5',
    toneKey: null,
    hintKey: null,
  },
  {
    key: 'totalInvestment',
    label: 'Total Investment',
    format: (value) => formatCurrency(value),
    accent: 'from-violet-500/20 to-fuchsia-400/5',
    toneKey: null,
    hintKey: null,
  },
  {
    key: 'totalMarketValue',
    label: 'Live Market Value',
    format: (value, summary) =>
      summary.livePricedHoldings > 0 ? formatCurrency(value) : '—',
    accent: 'from-cyan-500/20 to-sky-400/5',
    toneKey: null,
    hintKey: 'marketValueHint',
  },
  {
    key: 'totalUnrealizedGain',
    label: 'Unrealized P/L',
    format: (value, summary) =>
      summary.livePricedHoldings > 0 ? formatCurrency(value) : '—',
    accent: 'from-emerald-500/20 to-amber-400/5',
    toneKey: 'totalUnrealizedGain',
    hintKey: 'unrealizedHint',
  },
  {
    key: 'totalProfitLoss',
    label: 'Target Profit/Loss',
    format: (value) => formatCurrency(value),
    accent: 'from-emerald-500/20 to-rose-400/5',
    toneKey: 'totalProfitLoss',
    hintKey: null,
  },
]

function getSummaryHint(summary, hintKey) {
  if (hintKey === 'marketValueHint' || hintKey === 'unrealizedHint') {
    if (summary.livePricedHoldings > 0) {
      return `Based on ${summary.livePricedHoldings} holding${summary.livePricedHoldings === 1 ? '' : 's'} with live DSE prices`
    }

    if (summary.missingSymbolHoldings > 0) {
      return 'Edit holdings and add a DSE trading code (e.g. GP) to see live value'
    }

    if (summary.missingLivePriceHoldings > 0) {
      return 'Trading code added, but live price is not available yet. Click Refresh Prices'
    }

    return 'Only holdings with a DSE trading code show live market value'
  }

  return null
}

function SummaryCards({ summary }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {CARD_CONFIG.map((card) => {
        const value = summary[card.key] ?? 0
        const tone =
          card.toneKey && summary.livePricedHoldings > 0
            ? getAmountTone(summary[card.toneKey])
            : 'text-white'
        const hint = card.hintKey ? getSummaryHint(summary, card.hintKey) : null

        return (
          <article
            key={card.key}
            className={`glass-panel overflow-hidden bg-gradient-to-br ${card.accent}`}
          >
            <div className="px-5 py-5 sm:px-6">
              <p className="text-sm font-medium text-slate-300">{card.label}</p>
              <p className={`mt-4 text-3xl font-extrabold tracking-tight ${tone}`}>
                {card.format(value, summary)}
              </p>
              {hint ? <p className="mt-3 text-xs leading-5 text-slate-400">{hint}</p> : null}
            </div>
          </article>
        )
      })}
    </section>
  )
}

export default SummaryCards
