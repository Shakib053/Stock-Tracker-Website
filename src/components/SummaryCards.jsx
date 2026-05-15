import { formatCurrency, getAmountTone } from '../lib/formatters'

const CARD_CONFIG = [
  {
    key: 'totalStocks',
    label: 'Total Stocks',
    format: (value) => value,
    accent: 'from-sky-500/20 to-cyan-400/5',
  },
  {
    key: 'totalInvestment',
    label: 'Total Investment',
    format: (value) => formatCurrency(value),
    accent: 'from-violet-500/20 to-fuchsia-400/5',
  },
  {
    key: 'totalProfitLoss',
    label: 'Total Profit/Loss',
    format: (value) => formatCurrency(value),
    accent: 'from-emerald-500/20 to-amber-400/5',
  },
]

function SummaryCards({ summary }) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {CARD_CONFIG.map((card) => {
        const value = summary[card.key]
        const tone = card.key === 'totalProfitLoss' ? getAmountTone(value) : 'text-white'

        return (
          <article
            key={card.key}
            className={`glass-panel overflow-hidden bg-gradient-to-br ${card.accent}`}
          >
            <div className="px-5 py-5 sm:px-6">
              <p className="text-sm font-medium text-slate-300">{card.label}</p>
              <p className={`mt-4 text-3xl font-extrabold tracking-tight ${tone}`}>
                {card.format(value)}
              </p>
            </div>
          </article>
        )
      })}
    </section>
  )
}

export default SummaryCards
