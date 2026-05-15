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

export function normalizeStockValues(values) {
  return {
    stockName: values.stockName,
    buyingPrice: Number(values.buyingPrice),
    quantity: Number(values.quantity),
    soldPrice: Number(values.soldPrice),
    status: values.status,
  }
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
