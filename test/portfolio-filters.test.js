import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPortfolioSymbolOptions,
  filterPortfolioStocks,
} from '../src/lib/portfolioFilters.js'

const portfolio = [
  { id: '1', symbol: ' squrpharma ', status: 'holding' },
  { id: '2', symbol: 'SQURPHARMA', status: 'sold' },
  { id: '3', symbol: 'BATBC', status: 'holding' },
  { id: '4', symbol: '', status: 'holding' },
]

test('portfolio symbol options are unique, normalized, sorted, and exclude empty symbols', () => {
  assert.deepEqual(buildPortfolioSymbolOptions(portfolio), ['BATBC', 'SQURPHARMA'])
})

test('market symbols not owned by the user are not included', () => {
  const marketSymbols = ['BATBC', 'GP', 'RENATA', 'SQURPHARMA']
  const options = buildPortfolioSymbolOptions(portfolio)

  assert.deepEqual(options, ['BATBC', 'SQURPHARMA'])
  assert.equal(options.includes(marketSymbols[1]), false)
  assert.equal(options.includes(marketSymbols[2]), false)
})

test('symbol filtering matches normalized symbols and keeps all matching entries', () => {
  const filtered = filterPortfolioStocks(portfolio, { selectedSymbol: 'SQURPHARMA' })

  assert.deepEqual(filtered.map((stock) => stock.id), ['1', '2'])
})

test('symbol and status filters are applied together', () => {
  const filtered = filterPortfolioStocks(portfolio, {
    selectedSymbol: 'SQURPHARMA',
    selectedStatus: 'sold',
  })

  assert.deepEqual(filtered.map((stock) => stock.id), ['2'])
})

test('All Stocks retains entries without a symbol', () => {
  const filtered = filterPortfolioStocks(portfolio)

  assert.deepEqual(filtered.map((stock) => stock.id), ['1', '2', '3', '4'])
})
