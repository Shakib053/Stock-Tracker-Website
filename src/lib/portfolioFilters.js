import { normalizeSymbol } from './stockMath.js'

export function buildPortfolioSymbolOptions(stocks = []) {
  return Array.from(
    new Set(
      stocks
        .map((stock) => normalizeSymbol(stock.symbol))
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right))
}

export function filterPortfolioStocks(
  stocks = [],
  { selectedSymbol = 'all', selectedStatus = 'all' } = {},
) {
  return stocks.filter((stock) => {
    const matchesSymbol =
      selectedSymbol === 'all' || normalizeSymbol(stock.symbol) === selectedSymbol
    const matchesStatus = selectedStatus === 'all' || stock.status === selectedStatus

    return matchesSymbol && matchesStatus
  })
}
