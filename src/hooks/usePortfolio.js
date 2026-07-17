import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query, runTransaction, writeBatch } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import { COMMISSION_RATE, normalizeSymbol } from '../lib/portfolio'

const path = (uid, name) => collection(db, 'users', uid, name)

export function usePortfolio(user) {
  const [transactions, setTransactions] = useState([])
  const [lots, setLots] = useState([])
  const [legacyStocks, setLegacyStocks] = useState([])
  const [status, setStatus] = useState(user ? 'loading' : 'idle')
  const [error, setError] = useState('')
  const migrationRunning = useRef(false)
  const canUse = Boolean(isFirebaseConfigured && db && user?.uid)

  useEffect(() => {
    if (!canUse) return undefined
    setStatus('loading')
    const failures = (next) => { console.error(next); setError('Unable to load your private portfolio.'); setStatus('error') }
    const stops = [
      onSnapshot(query(path(user.uid, 'transactions'), orderBy('createdAt', 'desc')), (snap) => { setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setStatus('ready') }, failures),
      onSnapshot(query(path(user.uid, 'lots'), orderBy('createdAt', 'desc')), (snap) => setLots(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), failures),
      onSnapshot(query(path(user.uid, 'stocks'), orderBy('createdAt', 'desc')), (snap) => setLegacyStocks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), failures),
    ]
    return () => stops.forEach((stop) => stop())
  }, [canUse, user?.uid])

  const migrateLegacy = useCallback(async () => {
    const pending = legacyStocks.filter((stock) => !stock.migrationVersion)
    if (!canUse || !pending.length || migrationRunning.current) return
    migrationRunning.current = true
    try {
    for (const stock of pending) {
      const batch = writeBatch(db)
      const symbol = normalizeSymbol(stock.symbol || stock.stockName)
      if (!symbol) continue
      const base = `legacy-${stock.id}`
      const qty = Number(stock.quantity) || 0
      const now = new Date().toISOString()
      const common = { symbol, date: null, quantity: qty, commissionRate: COMMISSION_RATE, source: 'migration', legacyStockId: stock.id, createdAt: stock.createdAt || now, updatedAt: now }
      const buyId = `${base}-buy`, lotId = `${base}-lot`
      batch.set(doc(path(user.uid, 'transactions'), buyId), { id: buyId, type: 'buy', price: Number(stock.buyingPrice) || 0, ...common }, { merge: true })
      batch.set(doc(path(user.uid, 'lots'), lotId), { id: lotId, symbol, purchaseDate: null, originalQty: qty, remainingQty: stock.status === 'sold' ? 0 : qty, price: Number(stock.buyingPrice) || 0, lastQuote: stock.lastQuote == null ? null : Number(stock.lastQuote), commissionRate: COMMISSION_RATE, source: 'migration', buyTransactionId: buyId, legacyStockId: stock.id, createdAt: stock.createdAt || now, updatedAt: now }, { merge: true })
      if (stock.status === 'sold') {
        const sellId = `${base}-sell`
        batch.set(doc(path(user.uid, 'transactions'), sellId), { id: sellId, type: 'sell', price: Number(stock.soldPrice) || 0, allocations: [{ lotId, quantity: qty }], ...common }, { merge: true })
      }
      batch.set(doc(path(user.uid, 'stocks'), stock.id), { migratedAt: now, migrationVersion: 1 }, { merge: true })
      await batch.commit()
    }
    } finally {
      migrationRunning.current = false
    }
  }, [canUse, legacyStocks, user?.uid])

  useEffect(() => {
    if (status === 'ready' && legacyStocks.some((stock) => !stock.migrationVersion)) migrateLegacy().catch((e) => { console.error(e); setError('Existing records could not be migrated safely. No original records were deleted.') })
  }, [legacyStocks, migrateLegacy, status])

  const recordBuy = async ({ symbol, date, quantity, price }) => {
    const id = crypto.randomUUID(), lotId = crypto.randomUUID(), now = new Date().toISOString()
    const batch = writeBatch(db)
    batch.set(doc(path(user.uid, 'transactions'), id), { id, type: 'buy', symbol: normalizeSymbol(symbol), date, quantity: Number(quantity), price: Number(price), commissionRate: COMMISSION_RATE, source: 'manual', createdAt: now, updatedAt: now })
    batch.set(doc(path(user.uid, 'lots'), lotId), { id: lotId, symbol: normalizeSymbol(symbol), purchaseDate: date, originalQty: Number(quantity), remainingQty: Number(quantity), price: Number(price), commissionRate: COMMISSION_RATE, source: 'manual', buyTransactionId: id, createdAt: now, updatedAt: now })
    await batch.commit()
  }

  const recordSell = async ({ symbol, date, quantity, price, allocations }) => {
    const id = crypto.randomUUID(), now = new Date().toISOString()
    await runTransaction(db, async (fireTx) => {
      const refs = allocations.map((item) => doc(path(user.uid, 'lots'), item.lotId))
      const snapshots = await Promise.all(refs.map((ref) => fireTx.get(ref)))
      snapshots.forEach((snap, index) => {
        const requested = Number(allocations[index].quantity)
        if (!snap.exists() || requested <= 0 || Number(snap.data().remainingQty) < requested) throw new Error('A selected lot no longer has enough shares.')
        fireTx.update(refs[index], { remainingQty: Number(snap.data().remainingQty) - requested, updatedAt: now })
      })
      fireTx.set(doc(path(user.uid, 'transactions'), id), { id, type: 'sell', symbol: normalizeSymbol(symbol), date, quantity: Number(quantity), price: Number(price), allocations, commissionRate: COMMISSION_RATE, source: 'manual', createdAt: now, updatedAt: now })
    })
  }

  const completeMigrationDates = async (legacyId, purchaseDate, saleDate) => {
    const batch = writeBatch(db), now = new Date().toISOString()
    batch.update(doc(path(user.uid, 'transactions'), `legacy-${legacyId}-buy`), { date: purchaseDate, updatedAt: now })
    batch.update(doc(path(user.uid, 'lots'), `legacy-${legacyId}-lot`), { purchaseDate, updatedAt: now })
    const sold = transactions.some((tx) => tx.id === `legacy-${legacyId}-sell`)
    if (sold) batch.update(doc(path(user.uid, 'transactions'), `legacy-${legacyId}-sell`), { date: saleDate, updatedAt: now })
    batch.update(doc(path(user.uid, 'stocks'), legacyId), { migrationReviewedAt: now })
    await batch.commit()
  }

  const pendingReviews = useMemo(() => legacyStocks.filter((stock) => stock.migrationVersion && !stock.migrationReviewedAt), [legacyStocks])
  return { transactions, lots, pendingReviews, status, error, recordBuy, recordSell, completeMigrationDates }
}
