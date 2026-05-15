import { useMemo, useState } from 'react'
import AuthScreen from './components/AuthScreen'
import DeleteConfirmModal from './components/DeleteConfirmModal'
import StockFormModal from './components/StockFormModal'
import StockTable from './components/StockTable'
import SummaryCards from './components/SummaryCards'
import { DEFAULT_FORM_VALUES, STATUS_OPTIONS } from './lib/constants'
import { missingFirebaseConfig } from './lib/firebase'
import { calculateDerivedValues, createStockPayload, normalizeStockValues } from './lib/stockMath'
import { useAuth } from './hooks/useAuth'
import { useStocks } from './hooks/useStocks'

function App() {
  const { user, status: authStatus, error: authError, signIn, logOut, isConfigured } = useAuth()
  const { stocks, status: stocksStatus, error: stocksError, addStock, updateStock, deleteStock } = useStocks(user)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingStock, setEditingStock] = useState(null)
  const [deletingStock, setDeletingStock] = useState(null)
  const [selectedStockName, setSelectedStockName] = useState('all')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isSavingStock, setIsSavingStock] = useState(false)
  const [isDeletingStock, setIsDeletingStock] = useState(false)
  const [actionError, setActionError] = useState('')

  const computedStocks = useMemo(
    () => stocks.map((stock) => ({ ...stock, ...calculateDerivedValues(stock) })),
    [stocks],
  )

  const stockFilterOptions = useMemo(() => {
    return Array.from(new Set(computedStocks.map((stock) => stock.stockName))).sort((left, right) =>
      left.localeCompare(right),
    )
  }, [computedStocks])

  const filteredStocks = useMemo(() => {
    if (selectedStockName === 'all') {
      return computedStocks
    }

    return computedStocks.filter((stock) => stock.stockName === selectedStockName)
  }, [computedStocks, selectedStockName])

  const summary = useMemo(() => {
    return filteredStocks.reduce(
      (accumulator, stock) => {
        accumulator.totalStocks += 1
        accumulator.totalInvestment += stock.includingCommission * stock.quantity
        accumulator.totalProfitLoss += stock.amount
        return accumulator
      },
      {
        totalStocks: 0,
        totalInvestment: 0,
        totalProfitLoss: 0,
      },
    )
  }, [filteredStocks])

  const activeFilterLabel = selectedStockName === 'all' ? 'All Stocks' : selectedStockName

  const handleAddStock = async (values) => {
    setActionError('')
    setIsSavingStock(true)

    try {
      await addStock(createStockPayload(values))
      setIsAddOpen(false)
    } catch (error) {
      console.error('Failed to add stock entry.', error)
      setActionError('We could not save this stock entry. Please try again.')
    } finally {
      setIsSavingStock(false)
    }
  }

  const handleUpdateStock = async (values) => {
    if (!editingStock) {
      return
    }

    setActionError('')
    setIsSavingStock(true)

    try {
      await updateStock(editingStock.id, normalizeStockValues(values))
      setEditingStock(null)
    } catch (error) {
      console.error('Failed to update stock entry.', error)
      setActionError('We could not update this stock entry. Please try again.')
    } finally {
      setIsSavingStock(false)
    }
  }

  const handleDeleteStock = async () => {
    if (!deletingStock) {
      return
    }

    const shouldResetFilter =
      selectedStockName !== 'all' &&
      deletingStock.stockName === selectedStockName &&
      filteredStocks.length === 1

    setActionError('')
    setIsDeletingStock(true)

    try {
      await deleteStock(deletingStock.id)

      if (shouldResetFilter) {
        setSelectedStockName('all')
      }

      setDeletingStock(null)
    } catch (error) {
      console.error('Failed to delete stock entry.', error)
      setActionError('We could not delete this stock entry. Please try again.')
    } finally {
      setIsDeletingStock(false)
    }
  }

  const handleSignIn = async () => {
    setActionError('')
    setIsSigningIn(true)

    try {
      await signIn()
    } catch (error) {
      console.error('Failed to sign in.', error)
      setActionError('Google sign-in did not complete. Please try again.')
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleSignOut = async () => {
    setActionError('')

    try {
      await logOut()
      setIsAddOpen(false)
      setEditingStock(null)
      setDeletingStock(null)
      setSelectedStockName('all')
    } catch (error) {
      console.error('Failed to sign out.', error)
      setActionError('We could not sign you out right now. Please try again.')
    }
  }

  if (authStatus === 'loading') {
    return <StatusScreen title="Checking your session..." description="Verifying whether you are already signed in to your private dashboard." />
  }

  if (authStatus !== 'signed_in') {
    return (
      <AuthScreen
        authError={actionError || authError}
        isSigningIn={isSigningIn}
        onSignIn={handleSignIn}
        configError={
          isConfigured
            ? ''
            : `Missing Firebase config: ${missingFirebaseConfig.join(', ')}`
        }
      />
    )
  }

  const combinedError = actionError || stocksError

  return (
    <div className="app-shell">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/50 px-6 py-8 shadow-glow sm:px-8 lg:px-10">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-400/10 via-transparent to-emerald-400/10" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
                Stock Profit Tracker
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Track every stock position with private cloud access and instant profit insights.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                Manage entries from a secure dashboard, watch auto-calculations update in real
                time, and keep everything stored in your own Firebase account.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:items-end">
              <div className="text-sm text-slate-300 sm:text-right">
                <p className="font-semibold text-white">{user.displayName || 'Signed In'}</p>
                <p>{user.email}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(true)}
                  className="action-button rounded-2xl bg-accent px-5 py-3 text-slate-950 shadow-lg shadow-sky-500/20 hover:bg-sky-300"
                >
                  Add Stock Entry
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="action-button rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-slate-100 hover:bg-white/10"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="mt-6 flex-1 space-y-6">
          {combinedError ? (
            <section className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm leading-6 text-red-100">
              {combinedError}
            </section>
          ) : null}

          {stocksStatus === 'loading' ? (
            <StatusScreen
              title="Loading private records..."
              description="Fetching your stock entries from Firestore."
              compact
            />
          ) : null}

          <SummaryCards summary={summary} />

          <section className="glass-panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Portfolio Entries</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Track buying cost, target selling price, and profit or loss per stock.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:items-end">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  {STATUS_OPTIONS.map((status) => (
                    <span
                      key={status.value}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 uppercase tracking-wide"
                    >
                      {status.label}
                    </span>
                  ))}
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                  <label htmlFor="stock-filter" className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                    Filter View
                  </label>
                  <select
                    id="stock-filter"
                    value={selectedStockName}
                    onChange={(event) => setSelectedStockName(event.target.value)}
                    className="field-input min-w-[220px] py-2.5"
                  >
                    <option value="all">All Stocks</option>
                    {stockFilterOptions.map((stockName) => (
                      <option key={stockName} value={stockName}>
                        {stockName}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400">
                    Showing data for <span className="font-semibold text-white">{activeFilterLabel}</span>
                  </p>
                </div>
              </div>
            </div>

            <StockTable
              stocks={filteredStocks}
              activeFilterLabel={activeFilterLabel}
              onEdit={setEditingStock}
              onDelete={setDeletingStock}
            />
          </section>
        </main>
      </div>

      <StockFormModal
        isOpen={isAddOpen}
        title="Add Stock Entry"
        description="Create a new stock record and preview the calculations before saving."
        submitLabel="Save Stock"
        initialValues={DEFAULT_FORM_VALUES}
        isSubmitting={isSavingStock}
        onClose={() => setIsAddOpen(false)}
        onSubmit={handleAddStock}
      />

      <StockFormModal
        isOpen={Boolean(editingStock)}
        title="Edit Stock Entry"
        description="Update the values below. Calculations refresh instantly while you type."
        submitLabel="Update Stock"
        initialValues={editingStock ?? DEFAULT_FORM_VALUES}
        isSubmitting={isSavingStock}
        onClose={() => setEditingStock(null)}
        onSubmit={handleUpdateStock}
      />

      <DeleteConfirmModal
        isOpen={Boolean(deletingStock)}
        stockName={deletingStock?.stockName}
        onClose={() => setDeletingStock(null)}
        onConfirm={handleDeleteStock}
        isSubmitting={isDeletingStock}
      />
    </div>
  )
}

function StatusScreen({ title, description, compact = false }) {
  return (
    <div className={compact ? 'glass-panel px-5 py-10 text-center' : 'app-shell'}>
      <div
        className={
          compact
            ? 'mx-auto max-w-xl'
            : 'mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-8 sm:px-6 lg:px-8'
        }
      >
        <div className={compact ? 'w-full' : 'glass-panel w-full p-8 text-center'}>
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full border border-sky-400/30 bg-sky-400/10" />
          <h2 className="mt-5 text-2xl font-bold text-white">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
    </div>
  )
}

export default App
