import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'

function getUserStocksCollection(userId) {
  return collection(db, 'users', userId, 'stocks')
}

export function useStocks(user) {
  const [stocks, setStocks] = useState([])
  const [status, setStatus] = useState(user ? 'loading' : 'idle')
  const [error, setError] = useState('')

  const canAccessStocks = useMemo(() => Boolean(isFirebaseConfigured && db && user?.uid), [user])

  useEffect(() => {
    if (!canAccessStocks) {
      setStocks([])
      setStatus(user ? 'error' : 'idle')
      setError(user ? 'Firebase is not configured for this deployment yet.' : '')
      return undefined
    }

    setStatus('loading')
    setError('')

    const stocksQuery = query(getUserStocksCollection(user.uid), orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(
      stocksQuery,
      (snapshot) => {
        setStocks(snapshot.docs.map((stockDoc) => ({ id: stockDoc.id, ...stockDoc.data() })))
        setStatus('ready')
      },
      (nextError) => {
        console.error('Failed to load stock entries.', nextError)
        setError('We could not load your private stock records. Please try again.')
        setStatus('error')
      },
    )

    return unsubscribe
  }, [canAccessStocks, user])

  const addStock = async (stock) => {
    if (!canAccessStocks) {
      throw new Error('Firebase is not configured for this deployment yet.')
    }

    setError('')
    await setDoc(doc(getUserStocksCollection(user.uid), stock.id), stock)
  }

  const updateStock = async (stockId, updates) => {
    if (!canAccessStocks) {
      throw new Error('Firebase is not configured for this deployment yet.')
    }

    setError('')
    await updateDoc(doc(getUserStocksCollection(user.uid), stockId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    })
  }

  const deleteStock = async (stockId) => {
    if (!canAccessStocks) {
      throw new Error('Firebase is not configured for this deployment yet.')
    }

    setError('')
    await deleteDoc(doc(getUserStocksCollection(user.uid), stockId))
  }

  return {
    stocks,
    status,
    error,
    addStock,
    updateStock,
    deleteStock,
  }
}
