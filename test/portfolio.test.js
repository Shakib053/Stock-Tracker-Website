import assert from 'node:assert/strict'
import test from 'node:test'
import { COMMISSION_RATE, buildPositions, buildSummary, buildTransactionDeletion, commission, fiscalYear, inFiscalYear, netAmount, realizedProfit } from '../src/lib/portfolio.js'

test('uses 0.04% commission on both buy and sell transactions', () => {
  const buy = { type: 'buy', quantity: 100, price: 50 }
  const sell = { type: 'sell', quantity: 100, price: 60 }
  assert.equal(COMMISSION_RATE, 0.0004)
  assert.equal(commission(buy), 2)
  assert.equal(netAmount(buy), 5002)
  assert.equal(netAmount(sell), 5997.6)
})

test('realized profit uses exact quantities from multiple selected lots', () => {
  const lots = {
    first: { id: 'first', price: 40 },
    second: { id: 'second', price: 50 },
  }
  const sale = { type: 'sell', quantity: 15, price: 60, allocations: [{ lotId: 'first', quantity: 10 }, { lotId: 'second', quantity: 5 }] }
  assert.ok(Math.abs(realizedProfit(sale, lots) - 249.38) < 1e-9)
})

test('builds an aggregated position from remaining purchase lots', () => {
  const positions = buildPositions([
    { id: 'a', symbol: 'GP', remainingQty: 10, price: 100 },
    { id: 'b', symbol: 'GP', remainingQty: 5, price: 120 },
    { id: 'closed', symbol: 'GP', remainingQty: 0, price: 80 },
  ], { GP: { ltp: 130, change: 2 } })
  assert.equal(positions.length, 1)
  assert.equal(positions[0].quantity, 15)
  assert.equal(positions[0].lots, 2)
  assert.ok(Math.abs(positions[0].cost - 1600.64) < 1e-9)
})

test('Bangladesh fiscal years start July 1 and undated records are excluded', () => {
  assert.equal(fiscalYear('2026-06-30'), 'FY 2025–26')
  assert.equal(fiscalYear('2026-07-01'), 'FY 2026–27')
  assert.equal(fiscalYear(null), null)
  assert.equal(inFiscalYear(null, 'FY 2026–27'), false)
})

test('summary excludes undated migrated transactions from fiscal totals', () => {
  const lots = [{ id: 'lot', symbol: 'GP', remainingQty: 0, price: 100 }]
  const transactions = [
    { id: 'buy', type: 'buy', symbol: 'GP', date: null, quantity: 10, price: 100 },
    { id: 'sell', type: 'sell', symbol: 'GP', date: null, quantity: 10, price: 110, allocations: [{ lotId: 'lot', quantity: 10 }] },
  ]
  const summary = buildSummary([], transactions, lots, 'FY 2026–27')
  assert.equal(summary.fiscalInvestment, 0)
  assert.equal(summary.fiscalRealized, 0)
  assert.ok(summary.lifetimeRealized > 0)
})

test('summary reports distinct active stocks and currently held shares', () => {
  const positions = [{ symbol: 'GP', quantity: 15, cost: 100 }, { symbol: 'SQURPHARMA', quantity: 8, cost: 200 }]
  const summary = buildSummary(positions, [], [], 'FY 2026–27')
  assert.equal(summary.totalStocks, 2)
  assert.equal(summary.totalShares, 23)
})

test('deleting an unallocated buy removes its transaction and purchase lot', () => {
  const buy = { id: 'buy', type: 'buy' }
  const lot = { id: 'lot', buyTransactionId: 'buy' }
  const deletion = buildTransactionDeletion('buy', [buy], [lot])
  assert.deepEqual(deletion.transactionsToDelete, [buy])
  assert.deepEqual(deletion.lotsToDelete, [lot])
  assert.deepEqual(deletion.restorations, [])
})

test('deleting a sale restores all of its purchase-lot allocations', () => {
  const sale = { id: 'sale', type: 'sell', allocations: [{ lotId: 'a', quantity: 4 }, { lotId: 'b', quantity: 6 }] }
  const deletion = buildTransactionDeletion('sale', [sale], [])
  assert.deepEqual(deletion.transactionsToDelete, [sale])
  assert.deepEqual(deletion.restorations, sale.allocations)
})

test('deleting a buy cascades dependent sales and restores only unaffected lots', () => {
  const buy = { id: 'buy-a', type: 'buy' }
  const otherBuy = { id: 'buy-b', type: 'buy' }
  const sale = { id: 'sale', type: 'sell', allocations: [{ lotId: 'lot-a', quantity: 4 }, { lotId: 'lot-b', quantity: 6 }] }
  const lots = [{ id: 'lot-a', buyTransactionId: 'buy-a' }, { id: 'lot-b', buyTransactionId: 'buy-b' }]
  const deletion = buildTransactionDeletion('buy-a', [buy, otherBuy, sale], lots)
  assert.deepEqual(deletion.transactionsToDelete, [buy, sale])
  assert.deepEqual(deletion.lotsToDelete, [lots[0]])
  assert.deepEqual(deletion.restorations, [{ lotId: 'lot-b', quantity: 6 }])
})

test('migrated buy deletion retains the legacy identifier for source cleanup', () => {
  const buy = { id: 'legacy-stock-buy', type: 'buy', legacyStockId: 'stock' }
  const deletion = buildTransactionDeletion(buy.id, [buy], [])
  assert.equal(deletion.transaction.legacyStockId, 'stock')
})
