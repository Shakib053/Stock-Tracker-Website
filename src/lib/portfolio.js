export const COMMISSION_RATE = 0.0004

export const normalizeSymbol = (value) => String(value ?? '').trim().toUpperCase()
export const grossAmount = (tx) => Number(tx.quantity || 0) * Number(tx.price || 0)
export const commission = (tx) => grossAmount(tx) * Number(tx.commissionRate ?? COMMISSION_RATE)
export const netAmount = (tx) => tx.type === 'sell' ? grossAmount(tx) - commission(tx) : grossAmount(tx) + commission(tx)
export const lotUnitCost = (lot) => Number(lot.price || 0) * (1 + Number(lot.commissionRate ?? COMMISSION_RATE))

export function realizedProfit(tx, lotsById) {
  if (tx.type !== 'sell') return null
  const cost = (tx.allocations || []).reduce((sum, item) => {
    const lot = lotsById[item.lotId]
    return sum + (lot ? Number(item.quantity) * lotUnitCost(lot) : 0)
  }, 0)
  return netAmount(tx) - cost
}

export function fiscalYear(date) {
  if (!date) return null
  const [year, month] = date.split('-').map(Number)
  const start = month >= 7 ? year : year - 1
  return `FY ${start}\u2013${String(start + 1).slice(-2)}`
}

export function inFiscalYear(date, label) {
  if (!date || !label) return false
  return fiscalYear(date) === label
}

export function buildPositions(lots, quotes = {}, quotesAreStale = false) {
  const grouped = {}
  lots.filter((lot) => Number(lot.remainingQty) > 0).forEach((lot) => {
    const symbol = normalizeSymbol(lot.symbol)
    if (!grouped[symbol]) grouped[symbol] = { symbol, quantity: 0, cost: 0, lots: 0, lastQuote: null }
    grouped[symbol].quantity += Number(lot.remainingQty)
    grouped[symbol].cost += Number(lot.remainingQty) * lotUnitCost(lot)
    grouped[symbol].lots += 1
    if (lot.lastQuote != null) grouped[symbol].lastQuote = Number(lot.lastQuote)
  })
  return Object.values(grouped).map((position) => {
    const quote = quotes[position.symbol]
    const ltp = quote?.ltp ?? position.lastQuote ?? null
    const marketValue = ltp == null ? null : ltp * position.quantity
    const exitValue = marketValue == null ? null : marketValue * (1 - COMMISSION_RATE)
    const unrealized = exitValue == null ? null : exitValue - position.cost
    return {
      ...position, ltp, dayChange: quote?.change ?? null,
      quoteSource: quote ? (quotesAreStale ? 'cached' : 'live') : position.lastQuote != null ? 'cached' : 'none', marketValue,
      unrealized, returnPct: unrealized == null || !position.cost ? null : unrealized / position.cost * 100,
    }
  }).sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0))
}

export function buildSummary(positions, transactions, lots, selectedFiscal) {
  const lotsById = Object.fromEntries(lots.map((lot) => [lot.id, lot]))
  const datedFiscal = transactions.filter((tx) => inFiscalYear(tx.date, selectedFiscal))
  const sells = transactions.filter((tx) => tx.type === 'sell')
  const cost = positions.reduce((sum, item) => sum + item.cost, 0)
  const marketValue = positions.reduce((sum, item) => sum + (item.marketValue || 0), 0)
  const unrealized = positions.reduce((sum, item) => sum + (item.unrealized || 0), 0)
  return {
    cost, marketValue, unrealized, unrealizedPct: cost ? unrealized / cost * 100 : 0,
    fiscalInvestment: datedFiscal.filter((tx) => tx.type === 'buy').reduce((sum, tx) => sum + netAmount(tx), 0),
    fiscalRealized: datedFiscal.filter((tx) => tx.type === 'sell').reduce((sum, tx) => sum + realizedProfit(tx, lotsById), 0),
    lifetimeRealized: sells.reduce((sum, tx) => sum + realizedProfit(tx, lotsById), 0),
  }
}

export function fiscalYears(transactions, now = new Date()) {
  const current = fiscalYear(now.toISOString().slice(0, 10))
  return [...new Set([current, ...transactions.map((tx) => fiscalYear(tx.date)).filter(Boolean)])].sort().reverse()
}
