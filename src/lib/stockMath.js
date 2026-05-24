export function calculateDerivedValues(stock) {
  const buyingPrice = Number(stock.buyingPrice) || 0
  const quantity = Number(stock.quantity) || 0
  const soldPrice = Number(stock.soldPrice) || 0

  const includingCommission = buyingPrice + buyingPrice * 0.008
  const minSellingPrice = includingCommission * 1.1
  const profitPercent = includingCommission === 0
    ? 0
    : Math.ceil(((soldPrice - includingCommission) / includingCommission) * 100)
  const amount = Math.round((soldPrice - includingCommission) * quantity)

  return {
    includingCommission,
    minSellingPrice,
    profitPercent,
    amount,
  }
}

export function normalizeSymbol(symbol) {
  return String(symbol ?? '').trim().toUpperCase()
}

export function enrichStockWithQuote(stock, quotes = {}) {
  const symbol = normalizeSymbol(stock.symbol)
  const liveQuote = symbol ? quotes[symbol] : null
  const ltp = liveQuote?.ltp ?? stock.lastQuote ?? null
  const quantity = Number(stock.quantity) || 0
  const includingCommission = stock.includingCommission ?? calculateDerivedValues(stock).includingCommission
  const hasLivePrice = ltp != null

  const marketValue = hasLivePrice ? ltp * quantity : null
  const unrealizedGain = hasLivePrice ? Math.round((ltp - includingCommission) * quantity) : null
  const unrealizedGainPercent =
    hasLivePrice && includingCommission > 0
      ? Math.round(((ltp - includingCommission) / includingCommission) * 100)
      : null

  return {
    symbol,
    ltp,
    dayChange: liveQuote?.change ?? null,
    quoteSource: liveQuote ? 'live' : stock.lastQuote != null ? 'cached' : 'none',
    marketValue,
    unrealizedGain,
    unrealizedGainPercent,
  }
}

export function normalizeStockValues(values) {
  const normalized = {
    stockName: values.stockName,
    symbol: normalizeSymbol(values.symbol),
    buyingPrice: Number(values.buyingPrice),
    quantity: Number(values.quantity),
    soldPrice: Number(values.soldPrice),
    status: values.status,
  }

  if (values.lastQuote != null) {
    normalized.lastQuote = Number(values.lastQuote)
  }

  if (values.quoteUpdatedAt) {
    normalized.quoteUpdatedAt = values.quoteUpdatedAt
  }

  return normalized
}

export function createStockPayload(values) {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    ...normalizeStockValues(values),
    createdAt: now,
    updatedAt: now,
  }
}
