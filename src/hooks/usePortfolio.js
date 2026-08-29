import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query, runTransaction, writeBatch } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import { buildTransactionDeletion, COMMISSION_RATE, normalizeSymbol } from '../lib/portfolio'

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

  const deleteTransaction = async (transactionId) => {
    const deletion = buildTransactionDeletion(transactionId, transactions, lots)
    if (!deletion) throw new Error('The selected transaction no longer exists.')

    await runTransaction(db, async (fireTx) => {
      const transactionRefs = deletion.transactionsToDelete.map((item) => doc(path(user.uid, 'transactions'), item.id))
      const deletedLotRefs = deletion.lotsToDelete.map((lot) => doc(path(user.uid, 'lots'), lot.id))
      const restorationIds = [...new Set(deletion.restorations.map((item) => item.lotId))]
      const restorationRefs = restorationIds.map((id) => doc(path(user.uid, 'lots'), id))
      const legacyRef = deletion.transaction.type === 'buy' && deletion.transaction.legacyStockId
        ? doc(path(user.uid, 'stocks'), deletion.transaction.legacyStockId)
        : null
      const refs = [...transactionRefs, ...deletedLotRefs, ...restorationRefs, ...(legacyRef ? [legacyRef] : [])]
      const snapshots = await Promise.all(refs.map((ref) => fireTx.get(ref)))

      if (!snapshots[0]?.exists()) throw new Error('The selected transaction no longer exists.')
      const restorationOffset = transactionRefs.length + deletedLotRefs.length
      restorationRefs.forEach((ref, index) => {
        const snapshot = snapshots[restorationOffset + index]
        if (!snapshot.exists()) throw new Error('A related purchase lot no longer exists. Refresh and try again.')
        const quantity = deletion.restorations
          .filter((item) => item.lotId === restorationIds[index])
          .reduce((sum, item) => sum + Number(item.quantity || 0), 0)
        fireTx.update(ref, { remainingQty: Number(snapshot.data().remainingQty || 0) + quantity, updatedAt: new Date().toISOString() })
      })
      transactionRefs.forEach((ref) => fireTx.delete(ref))
      deletedLotRefs.forEach((ref) => fireTx.delete(ref))
      if (legacyRef) fireTx.delete(legacyRef)
    })
  }

  const updateTransaction = async (oldTx, updatedFields) => {
    const now = new Date().toISOString()
    
    if (oldTx.type === 'buy') {
      const { date, quantity, price } = updatedFields
      const newQty = Number(quantity)
      const newPrice = Number(price)
      
      await runTransaction(db, async (fireTx) => {
        const lotQuery = lots.find(l => l.buyTransactionId === oldTx.id)
        if (!lotQuery) throw new Error('Associated purchase lot not found.')
        
        const lotRef = doc(path(user.uid, 'lots'), lotQuery.id)
        const lotDoc = await fireTx.get(lotRef)
        if (!lotDoc.exists()) throw new Error('Purchase lot no longer exists.')
        
        const lotData = lotDoc.data()
        const soldQty = Number(lotData.originalQty) - Number(lotData.remainingQty)
        if (newQty < soldQty) {
          throw new Error(`Cannot reduce quantity below ${soldQty} as these shares have already been sold.`)
        }
        
        const remainingDiff = newQty - Number(lotData.originalQty)
        const newRemainingQty = Number(lotData.remainingQty) + remainingDiff
        
        fireTx.update(doc(path(user.uid, 'transactions'), oldTx.id), {
          date,
          quantity: newQty,
          price: newPrice,
          updatedAt: now
        })
        
        fireTx.update(lotRef, {
          purchaseDate: date,
          originalQty: newQty,
          remainingQty: newRemainingQty,
          price: newPrice,
          updatedAt: now
        })
      })
    } else if (oldTx.type === 'sell') {
      const { date, quantity, price, allocations } = updatedFields
      const newQty = Number(quantity)
      const newPrice = Number(price)
      
      await runTransaction(db, async (fireTx) => {
        const oldAllocations = oldTx.allocations || []
        const lotRefsMap = new Map()
        
        for (const alloc of oldAllocations) {
          const ref = doc(path(user.uid, 'lots'), alloc.lotId)
          lotRefsMap.set(alloc.lotId, ref)
        }
        for (const alloc of allocations) {
          if (!lotRefsMap.has(alloc.lotId)) {
            lotRefsMap.set(alloc.lotId, doc(path(user.uid, 'lots'), alloc.lotId))
          }
        }
        
        const uniqueRefs = Array.from(lotRefsMap.values())
        const snapshots = await Promise.all(uniqueRefs.map(ref => fireTx.get(ref)))
        const lotDataMap = {}
        
        snapshots.forEach((snap, idx) => {
          if (!snap.exists()) throw new Error('One of the purchase lots no longer exists.')
          lotDataMap[snap.id] = {
            ref: uniqueRefs[idx],
            remainingQty: Number(snap.data().remainingQty || 0)
          }
        })
        
        for (const alloc of oldAllocations) {
          if (lotDataMap[alloc.lotId]) {
            lotDataMap[alloc.lotId].remainingQty += Number(alloc.quantity)
          }
        }
        
        for (const alloc of allocations) {
          const requested = Number(alloc.quantity)
          if (!lotDataMap[alloc.lotId] || requested > lotDataMap[alloc.lotId].remainingQty) {
            throw new Error('A selected purchase lot does not have enough shares.')
          }
          lotDataMap[alloc.lotId].remainingQty -= requested
        }
        
        for (const lotId in lotDataMap) {
          fireTx.update(lotDataMap[lotId].ref, {
            remainingQty: lotDataMap[lotId].remainingQty,
            updatedAt: now
          })
        }
        
        fireTx.update(doc(path(user.uid, 'transactions'), oldTx.id), {
          date,
          quantity: newQty,
          price: newPrice,
          allocations,
          updatedAt: now
        })
      })
    }
  }

  const pendingReviews = useMemo(() => legacyStocks.filter((stock) => stock.migrationVersion && !stock.migrationReviewedAt), [legacyStocks])
  return { transactions, lots, pendingReviews, status, error, recordBuy, recordSell, updateTransaction, deleteTransaction, completeMigrationDates }
}
