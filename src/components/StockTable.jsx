import { formatCurrency, formatNumber, formatPercent, getAmountTone } from '../lib/formatters'

function StockTable({ stocks, activeFilterLabel, onEdit, onDelete }) {
  if (stocks.length === 0) {
    return (
      <div className="px-5 py-14 text-center sm:px-6">
        <div className="mx-auto max-w-md">
          <h3 className="text-xl font-semibold text-white">
            {activeFilterLabel === 'All Stocks' ? 'No stocks added yet' : `No entries found for ${activeFilterLabel}`}
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {activeFilterLabel === 'All Stocks'
              ? 'Start by adding your first stock entry. The dashboard will automatically calculate commission, target selling price, and overall profit or loss.'
              : 'Try switching back to All Stocks or add another entry for this stock to see its data here.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-400">
              {[
                'Stock Name',
                'Buying Price',
                'Including Commission',
                'Min Selling Price',
                'Quantity',
                'Sold Price',
                'Profit %',
                'Status',
                'Amount',
                'Actions',
              ].map((label) => (
                <th key={label} className="px-4 py-4 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {stocks.map((stock) => (
              <tr key={stock.id} className="text-sm text-slate-200">
                <td className="px-4 py-4 font-semibold text-white">{stock.stockName}</td>
                <td className="px-4 py-4">{formatCurrency(stock.buyingPrice, 3)}</td>
                <td className="px-4 py-4">{formatCurrency(stock.includingCommission, 3)}</td>
                <td className="px-4 py-4">{formatCurrency(stock.minSellingPrice, 3)}</td>
                <td className="px-4 py-4">{formatNumber(stock.quantity)}</td>
                <td className="px-4 py-4">{formatCurrency(stock.soldPrice, 3)}</td>
                <td className={`px-4 py-4 font-semibold ${getAmountTone(stock.profitPercent)}`}>
                  {formatPercent(stock.profitPercent)}
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={stock.status} />
                </td>
                <td className={`px-4 py-4 font-semibold ${getAmountTone(stock.amount)}`}>
                  {formatCurrency(stock.amount, 0)}
                </td>
                <td className="px-4 py-4">
                  <RowActions onEdit={() => onEdit(stock)} onDelete={() => onDelete(stock)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 p-4 lg:hidden">
        {stocks.map((stock) => (
          <article key={stock.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{stock.stockName}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Qty {formatNumber(stock.quantity)} • Sold {formatCurrency(stock.soldPrice, 3)}
                </p>
              </div>
              <StatusBadge status={stock.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MobileMetric label="Buying Price" value={formatCurrency(stock.buyingPrice, 3)} />
              <MobileMetric
                label="Incl. Commission"
                value={formatCurrency(stock.includingCommission, 3)}
              />
              <MobileMetric
                label="Min Selling"
                value={formatCurrency(stock.minSellingPrice, 3)}
              />
              <MobileMetric label="Profit %" value={formatPercent(stock.profitPercent)} />
              <MobileMetric
                label="Amount"
                value={formatCurrency(stock.amount, 0)}
                tone={getAmountTone(stock.amount)}
              />
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => onEdit(stock)}
                className="action-button flex-1 border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(stock)}
                className="action-button flex-1 border border-danger/30 bg-danger/10 text-red-200 hover:bg-danger/20"
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}

function MobileMetric({ label, value, tone = 'text-white' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles =
    status === 'sold'
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
      : 'border-amber-400/30 bg-amber-400/10 text-amber-300'

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${styles}`}>
      {status}
    </span>
  )
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onEdit}
        className="action-button border border-white/10 bg-white/5 px-3 py-2 text-slate-100 hover:bg-white/10"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="action-button border border-danger/30 bg-danger/10 px-3 py-2 text-red-200 hover:bg-danger/20"
      >
        Delete
      </button>
    </div>
  )
}

export default StockTable
