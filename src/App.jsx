import { useEffect, useMemo, useState } from 'react'
import AuthScreen from './components/AuthScreen'
import Modal from './components/Modal'
import { useAuth } from './hooks/useAuth'
import { useDseQuotes } from './hooks/useDseQuotes'
import { usePortfolio } from './hooks/usePortfolio'
import { buildPositions, buildSummary, buildTransactionDeletion, commission, fiscalYears, grossAmount, inFiscalYear, netAmount, realizedProfit } from './lib/portfolio'
import { missingFirebaseConfig } from './lib/firebase'

const money = (value, digits = 2) => `৳${Number(value || 0).toLocaleString('en-BD', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
const number = (value) => Number(value || 0).toLocaleString('en-BD')
const percent = (value) => `${Number(value || 0) >= 0 ? '+' : '−'}${Math.abs(Number(value || 0)).toFixed(2)}%`
const prettyDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-BD', { dateStyle: 'medium' }) : 'Date missing'
const today = () => new Date().toISOString().slice(0, 10)

function parseRoute() {
  const hash = decodeURIComponent(location.hash.slice(1)) || 'dashboard'
  if (hash.startsWith('stock/')) return { page: 'stock', id: hash.slice(6) }
  if (hash.startsWith('fiscal/')) return { page: 'fiscal-detail', id: hash.slice(7) }
  return { page: hash, id: '' }
}

export default function App() {
  const auth = useAuth()
  const market = useDseQuotes({ enabled: auth.status === 'signed_in' })
  const portfolio = usePortfolio(auth.user)
  const [route, setRoute] = useState(parseRoute)
  const [trade, setTrade] = useState(null)
  const [actionError, setActionError] = useState('')
  const [dashboardFiscal, setDashboardFiscal] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)
  useEffect(() => { const update = () => setRoute(parseRoute()); addEventListener('hashchange', update); return () => removeEventListener('hashchange', update) }, [])
  const navigate = (target) => { location.hash = target; window.scrollTo({ top: 0, behavior: 'smooth' }) }

  if (auth.status === 'loading') return <Loading title="Checking your session…" />
  if (auth.status !== 'signed_in') return <AuthScreen authError={actionError || auth.error} isSigningIn={isSigningIn} configError={auth.isConfigured ? '' : `Missing Firebase config: ${missingFirebaseConfig.join(', ')}`} onSignIn={async () => { setIsSigningIn(true); setActionError(''); try { await auth.signIn() } catch { setActionError('Google sign-in did not complete.') } finally { setIsSigningIn(false) } }} />

  const positions = buildPositions(portfolio.lots, market.quotes, market.isStale)
  const years = fiscalYears(portfolio.transactions)
  const activeFiscal = route.page === 'fiscal-detail' ? route.id : dashboardFiscal || years[0]
  const summary = buildSummary(positions, portfolio.transactions, portfolio.lots, activeFiscal)
  const pageTitle = route.page === 'stock' ? route.id : route.page === 'fiscal-detail' ? route.id : ({ dashboard: 'Dashboard', portfolio: 'Portfolio', transactions: 'Transactions', 'fiscal-years': 'Fiscal Years', migration: 'Needs Review' }[route.page] || 'Dashboard')

  return <div className="terminal-shell">
    <Sidebar page={route.page} count={positions.length} reviews={portfolio.pendingReviews.length} navigate={navigate} />
    <div className="terminal-workspace">
      <header className="terminal-topbar"><div><p className="eyebrow">DSE Portfolio Terminal</p><h1>{pageTitle}</h1></div><div className="topbar-actions"><span className="market-state"><i />{market.isStale ? 'Cached prices' : 'DSE prices live'}</span><button className="btn buy" onClick={() => setTrade({ type: 'buy' })}>＋ Buy</button><button className="btn sell" onClick={() => setTrade({ type: 'sell' })} disabled={!positions.length}>− Sell</button><button className="avatar" title="Sign out" onClick={auth.logOut}>{(auth.user.displayName || auth.user.email || 'U').slice(0, 2).toUpperCase()}</button></div></header>
      <main className="terminal-main">
        {(actionError || portfolio.error) && <div className="alert">{actionError || portfolio.error}</div>}
        {portfolio.status === 'loading' ? <Loading title="Loading your private portfolio…" compact /> : <>
          {route.page === 'dashboard' && <Dashboard user={auth.user} summary={summary} positions={positions} transactions={portfolio.transactions} lots={portfolio.lots} fiscal={activeFiscal} years={years} onFiscal={setDashboardFiscal} navigate={navigate} refresh={market.refresh} setTrade={setTrade} />}
          {route.page === 'portfolio' && <Portfolio positions={positions} navigate={navigate} setTrade={setTrade} />}
          {route.page === 'stock' && <StockDetail symbol={route.id} positions={positions} lots={portfolio.lots} transactions={portfolio.transactions} quotes={market.quotes} fiscal={activeFiscal} navigate={navigate} setTrade={setTrade} />}
          {route.page === 'transactions' && <Transactions transactions={portfolio.transactions} lots={portfolio.lots} years={years} navigate={navigate} setTrade={setTrade} onDelete={portfolio.deleteTransaction} setError={setActionError} />}
          {route.page === 'fiscal-years' && <FiscalYears years={years} transactions={portfolio.transactions} lots={portfolio.lots} navigate={navigate} />}
          {route.page === 'fiscal-detail' && <FiscalDetail fiscal={route.id} transactions={portfolio.transactions} lots={portfolio.lots} navigate={navigate} />}
          {route.page === 'migration' && <MigrationInbox records={portfolio.pendingReviews} transactions={portfolio.transactions} onComplete={portfolio.completeMigrationDates} />}
        </>}
      </main>
    </div>
    <TradeModal mode={trade} positions={positions} lots={portfolio.lots} symbols={Object.keys(market.quotes).sort()} quotes={market.quotes} onClose={() => setTrade(null)} onBuy={portfolio.recordBuy} onSell={portfolio.recordSell} onDone={(target) => { setTrade(null); navigate(target) }} setError={setActionError} />
  </div>
}

function Sidebar({ page, count, reviews, navigate }) {
  const active = page === 'stock' ? 'portfolio' : page === 'fiscal-detail' ? 'fiscal-years' : page
  const links = [['dashboard', '▦', 'Dashboard'], ['portfolio', '◫', 'Portfolio'], ['transactions', '⇄', 'Transactions'], ['fiscal-years', '▤', 'Fiscal Years'], ['migration', '!', 'Needs Review']]
  return <><aside className="terminal-sidebar"><div className="brand"><span>DT</span><div><strong>DSE Terminal</strong><small>Private portfolio</small></div></div><p className="nav-label">Workspace</p><nav>{links.map(([id, icon, label]) => <button key={id} className={active === id ? 'active' : ''} onClick={() => navigate(id)}><span>{icon}</span>{label}{id === 'portfolio' && <b>{count}</b>}{id === 'migration' && reviews > 0 && <b className="review-count">{reviews}</b>}</button>)}</nav></aside><nav className="mobile-nav">{links.slice(0, 4).map(([id, icon, label]) => <button key={id} className={active === id ? 'active' : ''} onClick={() => navigate(id)}><span>{icon}</span>{label}</button>)}</nav></>
}

function Dashboard({ user, summary, positions, transactions, lots, fiscal, years, onFiscal, navigate, refresh, setTrade }) {
  return <div className="page-stack"><PageHeader eyebrow="Portfolio overview" title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${(user.displayName || 'Investor').split(' ')[0]}`} text="Current holdings and realized performance for the selected Bangladesh fiscal year." actions={<><select className="input" value={fiscal} onChange={(e) => onFiscal(e.target.value)}>{years.map((year) => <option key={year}>{year}</option>)}</select><button className="btn" onClick={refresh}>↻ Refresh prices</button></>} />
    <Metrics items={[["Total Stocks", number(summary.totalStocks), `${number(summary.totalShares)} total shares currently held`, undefined, () => navigate('portfolio')], ['Current Cost Basis', money(summary.cost), 'Capital remaining in open lots'], ['Current Market Value', money(summary.marketValue), 'Latest available DSE prices'], ['Unrealized P/L', money(summary.unrealized), `${percent(summary.unrealizedPct)} after estimated sell fee`, summary.unrealized], [`${fiscal} Realized P/L`, money(summary.fiscalRealized), 'Completed dated sales', summary.fiscalRealized], ['Invested This FY', money(summary.fiscalInvestment), 'Buy value including commission'], ['Lifetime Realized P/L', money(summary.lifetimeRealized), 'All recorded sales', summary.lifetimeRealized]]} />
    <section className="panel"><PanelHeader title="Open Positions" subtitle={`${positions.length} active stocks • specific-lot cost basis`} action={<button className="btn small" onClick={() => navigate('portfolio')}>View portfolio</button>} /><PositionTable positions={positions} navigate={navigate} setTrade={setTrade} /></section>
    <section className="panel"><PanelHeader title="Recent Activity" subtitle="Latest five transactions" /><TransactionTable transactions={[...transactions].sort(sortTransactions).slice(0, 5)} lots={lots} navigate={navigate} /></section>
  </div>
}

function Portfolio({ positions, navigate, setTrade }) {
  const [search, setSearch] = useState(''), [pl, setPl] = useState('all'), [sort, setSort] = useState('market')
  const shown = positions.filter((p) => p.symbol.includes(search.toUpperCase())).filter((p) => pl === 'all' || (pl === 'profit' ? p.unrealized >= 0 : p.unrealized < 0)).sort((a, b) => sort === 'symbol' ? a.symbol.localeCompare(b.symbol) : sort === 'return' ? (b.returnPct || 0) - (a.returnPct || 0) : (b.marketValue || 0) - (a.marketValue || 0))
  return <div className="page-stack"><PageHeader eyebrow="Current holdings" title="Portfolio" text="Aggregated open positions. Sales use exact purchase-lot selection." actions={<button className="btn buy" onClick={() => setTrade({ type: 'buy' })}>＋ Buy Stock</button>} /><section className="panel"><div className="filters"><input className="input" placeholder="Search symbol" value={search} onChange={(e) => setSearch(e.target.value)} /><select className="input" value={pl} onChange={(e) => setPl(e.target.value)}><option value="all">Profit & loss</option><option value="profit">Profit only</option><option value="loss">Loss only</option></select><select className="input" value={sort} onChange={(e) => setSort(e.target.value)}><option value="market">Sort: Market value</option><option value="return">Sort: Return %</option><option value="symbol">Sort: Symbol</option></select></div><PositionTable positions={shown} navigate={navigate} setTrade={setTrade} /></section></div>
}

function StockDetail({ symbol, positions, lots, transactions, quotes, fiscal, navigate, setTrade }) {
  const position = positions.find((item) => item.symbol === symbol), openLots = lots.filter((lot) => lot.symbol === symbol && lot.remainingQty > 0), txs = transactions.filter((tx) => tx.symbol === symbol).sort(sortTransactions), quote = quotes[symbol]
  if (!position && !txs.length) return <Empty title="Stock not found" text="This stock is not present in your portfolio." />
  const lotsById = Object.fromEntries(lots.map((lot) => [lot.id, lot]))
  const fy = txs.filter((tx) => tx.type === 'sell' && inFiscalYear(tx.date, fiscal)).reduce((s, tx) => s + realizedProfit(tx, lotsById), 0)
  return <div className="page-stack"><button className="back" onClick={() => navigate('portfolio')}>← Back to Portfolio</button><section className="panel stock-hero"><div><p className="eyebrow">Stock position</p><h2>{symbol}</h2><strong className="hero-price">{quote?.ltp == null ? 'Price unavailable' : money(quote.ltp)}</strong><p className={quote?.change >= 0 ? 'positive' : 'negative'}>{quote?.change == null ? 'No live change' : `${quote.change >= 0 ? '▲' : '▼'} ${money(quote.change)}`}</p></div><div className="header-actions"><button className="btn buy" onClick={() => setTrade({ type: 'buy', symbol })}>＋ Buy More</button>{position && <button className="btn sell" onClick={() => setTrade({ type: 'sell', symbol })}>− Sell Shares</button>}</div></section>{position && <Metrics items={[['Open Quantity', number(position.quantity), `${openLots.length} purchase lots`], ['Cost Basis', money(position.cost), 'Remaining acquisition cost'], ['Market Value', money(position.marketValue), 'Gross current value'], ['Unrealized P/L', money(position.unrealized), percent(position.returnPct), position.unrealized], [`${fiscal} Realized`, money(fy), 'Completed sales', fy]]} />}
    <section className="panel"><PanelHeader title="Open Purchase Lots" subtitle="Exact lots available for future sales" /><div className="table-wrap"><table><thead><tr><th>Purchase date</th><th>Price</th><th>Original</th><th>Remaining</th><th>Source</th><th /></tr></thead><tbody>{openLots.map((lot) => <tr key={lot.id}><td>{prettyDate(lot.purchaseDate)}</td><td>{money(lot.price)}</td><td>{number(lot.originalQty)}</td><td>{number(lot.remainingQty)}</td><td><Pill>{lot.source}</Pill></td><td><button className="btn small sell" onClick={() => setTrade({ type: 'sell', symbol, lotId: lot.id })}>Sell lot</button></td></tr>)}</tbody></table></div></section>
    <section className="panel"><PanelHeader title="Transaction History" subtitle={`All buys and sells for ${symbol}`} /><TransactionTable transactions={txs} lots={lots} navigate={navigate} /></section></div>
}

function Transactions({ transactions, lots, years, navigate, setTrade, onDelete, setError }) {
  const [search, setSearch] = useState(''), [type, setType] = useState('all'), [fy, setFy] = useState('all')
  const [pendingDelete, setPendingDelete] = useState(null), [deleting, setDeleting] = useState(false)
  const shown = [...transactions].sort(sortTransactions).filter((tx) => tx.symbol.includes(search.toUpperCase())).filter((tx) => type === 'all' || tx.type === type).filter((tx) => fy === 'all' || inFiscalYear(tx.date, fy))
  const confirmDelete = async () => { setDeleting(true); setError(''); try { await onDelete(pendingDelete.id); setPendingDelete(null) } catch (error) { setError(error.message || 'The transaction could not be deleted.') } finally { setDeleting(false) } }
  return <div className="page-stack"><PageHeader eyebrow="Audit ledger" title="Transactions" text="Every buy and sell, including commission and exact realized profit." actions={<><button className="btn buy" onClick={() => setTrade({ type: 'buy' })}>＋ Record Buy</button><button className="btn sell" onClick={() => setTrade({ type: 'sell' })}>− Record Sell</button></>} /><section className="panel"><div className="filters"><input className="input" placeholder="Search symbol" value={search} onChange={(e) => setSearch(e.target.value)} /><select className="input" value={type} onChange={(e) => setType(e.target.value)}><option value="all">All transaction types</option><option value="buy">Buy only</option><option value="sell">Sell only</option></select><select className="input" value={fy} onChange={(e) => setFy(e.target.value)}><option value="all">All fiscal years</option>{years.map((year) => <option key={year}>{year}</option>)}</select></div><TransactionTable transactions={shown} lots={lots} navigate={navigate} onDelete={setPendingDelete} /></section><DeleteTransactionModal transaction={pendingDelete} transactions={transactions} lots={lots} isSubmitting={deleting} onClose={() => !deleting && setPendingDelete(null)} onConfirm={confirmDelete} /></div>
}

function FiscalYears({ years, transactions, lots, navigate }) {
  const lotsById = Object.fromEntries(lots.map((lot) => [lot.id, lot]))
  return <div className="page-stack"><PageHeader eyebrow="Year-over-year accounting" title="Fiscal Years" text="Bangladesh fiscal years run from July 1 through June 30. Undated migrated records are excluded." /><div className="fiscal-grid">{years.map((year) => { const txs = transactions.filter((tx) => inFiscalYear(tx.date, year)); const realized = txs.filter((tx) => tx.type === 'sell').reduce((s, tx) => s + realizedProfit(tx, lotsById), 0); return <button className="fiscal-card" key={year} onClick={() => navigate(`fiscal/${encodeURIComponent(year)}`)}><p className="eyebrow">Fiscal report</p><h2>{year}</h2><strong className={realized >= 0 ? 'positive' : 'negative'}>{money(realized)}</strong><span>Realized profit / loss</span><div><b>{txs.length}</b> transactions</div></button> })}</div></div>
}

function FiscalDetail({ fiscal, transactions, lots, navigate }) {
  const txs = transactions.filter((tx) => inFiscalYear(tx.date, fiscal)).sort(sortTransactions), lotsById = Object.fromEntries(lots.map((lot) => [lot.id, lot]))
  const buys = txs.filter((tx) => tx.type === 'buy'), sells = txs.filter((tx) => tx.type === 'sell')
  const values = { investment: buys.reduce((s, tx) => s + netAmount(tx), 0), grossSales: sells.reduce((s, tx) => s + grossAmount(tx), 0), netSales: sells.reduce((s, tx) => s + netAmount(tx), 0), fees: txs.reduce((s, tx) => s + commission(tx), 0), realized: sells.reduce((s, tx) => s + realizedProfit(tx, lotsById), 0) }
  const perStock = [...new Set(txs.map((tx) => tx.symbol))].map((symbol) => { const stockTx = txs.filter((tx) => tx.symbol === symbol); return { symbol, bought: stockTx.filter((tx) => tx.type === 'buy').reduce((s, tx) => s + Number(tx.quantity), 0), buyCost: stockTx.filter((tx) => tx.type === 'buy').reduce((s, tx) => s + netAmount(tx), 0), sold: stockTx.filter((tx) => tx.type === 'sell').reduce((s, tx) => s + Number(tx.quantity), 0), proceeds: stockTx.filter((tx) => tx.type === 'sell').reduce((s, tx) => s + netAmount(tx), 0), realized: stockTx.filter((tx) => tx.type === 'sell').reduce((s, tx) => s + realizedProfit(tx, lotsById), 0) } })
  return <div className="page-stack"><button className="back" onClick={() => navigate('fiscal-years')}>← Back to Fiscal Years</button><PageHeader eyebrow="Fiscal-year report" title={fiscal} text="Dated transactions from July 1 through June 30." /><Metrics items={[['Buy Investment', money(values.investment), 'Including commission'], ['Gross Sale Value', money(values.grossSales), 'Before sell commission'], ['Net Sale Proceeds', money(values.netSales), 'After sell commission'], ['Total Commission', money(values.fees), 'Buy and sell commission'], ['Realized P/L', money(values.realized), 'Assigned by sale date', values.realized], ['Transactions', txs.length, 'Buys and sells']]} /><section className="panel"><PanelHeader title="Per-Stock Results" subtitle={`Trading activity during ${fiscal}`} /><div className="table-wrap"><table><thead><tr><th>Symbol</th><th>Bought Qty</th><th>Buy Cost</th><th>Sold Qty</th><th>Net Proceeds</th><th>Realized P/L</th></tr></thead><tbody>{perStock.map((item) => <tr key={item.symbol}><td><button className="symbol-link" onClick={() => navigate(`stock/${item.symbol}`)}>{item.symbol}</button></td><td>{number(item.bought)}</td><td>{money(item.buyCost)}</td><td>{number(item.sold)}</td><td>{money(item.proceeds)}</td><td className={item.realized >= 0 ? 'positive' : 'negative'}>{money(item.realized)}</td></tr>)}</tbody></table></div></section><section className="panel"><PanelHeader title="Fiscal-Year Transactions" subtitle="Complete transaction list" /><TransactionTable transactions={txs} lots={lots} navigate={navigate} /></section></div>
}

function MigrationInbox({ records, transactions, onComplete }) {
  if (!records.length) return <div className="page-stack"><PageHeader eyebrow="Data migration" title="Needs Review" text="All migrated records have complete dates." /><Empty title="You're all caught up" text="There are no migrated entries waiting for dates." /></div>
  return <div className="page-stack"><PageHeader eyebrow="Data migration" title="Needs Review" text="Add historical dates when convenient. Until then, these records stay out of fiscal reports." />{records.map((record) => <ReviewCard key={record.id} record={record} sold={transactions.some((tx) => tx.id === `legacy-${record.id}-sell`)} onComplete={onComplete} />)}</div>
}

function ReviewCard({ record, sold, onComplete }) {
  const [buyDate, setBuyDate] = useState(''), [sellDate, setSellDate] = useState(''), [saving, setSaving] = useState(false)
  return <section className="panel review-card"><div><Pill>Migrated</Pill><h2>{record.symbol || record.stockName}</h2><p>{number(record.quantity)} shares • Buy {money(record.buyingPrice)}{sold ? ` • Sold ${money(record.soldPrice)}` : ''}</p></div><div className="review-fields"><label>Purchase date<input className="input" type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} /></label>{sold && <label>Sale date<input className="input" type="date" min={buyDate} value={sellDate} onChange={(e) => setSellDate(e.target.value)} /></label>}<button className="btn buy" disabled={!buyDate || (sold && !sellDate) || saving} onClick={async () => { setSaving(true); await onComplete(record.id, buyDate, sellDate); setSaving(false) }}>{saving ? 'Saving…' : 'Complete review'}</button></div></section>
}

function DeleteTransactionModal({ transaction, transactions, lots, isSubmitting, onClose, onConfirm }) {
  if (!transaction) return null
  const deletion = buildTransactionDeletion(transaction.id, transactions, lots)
  const lotsById = Object.fromEntries(lots.map((lot) => [lot.id, lot]))
  const dependentSales = Math.max(0, (deletion?.transactionsToDelete.length || 1) - 1)
  const restoredLots = new Set((deletion?.restorations || []).map((item) => item.lotId)).size
  const realized = transaction.type === 'sell' ? realizedProfit(transaction, lotsById) : null
  const description = transaction.type === 'sell'
    ? `${number(transaction.quantity)} shares will be restored to ${restoredLots} purchase ${restoredLots === 1 ? 'lot' : 'lots'}, and its realized P/L will be removed.`
    : dependentSales
      ? `This buy is used by ${dependentSales} sale ${dependentSales === 1 ? 'transaction' : 'transactions'}. Those linked sales will also be deleted to preserve lot accounting.`
      : 'This buy and its purchase lot will be removed, and all portfolio totals will recalculate.'

  return <Modal isOpen title={`Delete ${transaction.type === 'buy' ? 'Buy' : 'Sale'} — ${transaction.symbol}`} description="This action cannot be undone." onClose={onClose} footer={<div className="modal-actions"><button className="btn" disabled={isSubmitting} onClick={onClose}>Cancel</button><button className="btn delete" disabled={isSubmitting} onClick={onConfirm}>{isSubmitting ? 'Deleting…' : 'Delete Entire Entry'}</button></div>}>
    <div className="delete-warning"><strong>{description}</strong></div>
    <div className="calculation">
      <p><span>Transaction ID</span><b>{transaction.id}</b></p>
      <p><span>Type</span><b>{transaction.type.toUpperCase()}</b></p>
      <p><span>Trade date</span><b>{prettyDate(transaction.date)}</b></p>
      <p><span>Quantity</span><b>{number(transaction.quantity)}</b></p>
      <p><span>Net amount</span><b>{money(netAmount(transaction))}</b></p>
      {transaction.type === 'sell' && <p><span>Realized P/L removed</span><b className={realized >= 0 ? 'positive' : 'negative'}>{money(realized)}</b></p>}
      {transaction.type === 'buy' && <><p><span>Purchase lots removed</span><b>{deletion?.lotsToDelete.length || 0}</b></p><p><span>Linked sales removed</span><b className={dependentSales ? 'negative' : ''}>{dependentSales}</b></p></>}
    </div>
  </Modal>
}

function TradeModal({ mode, positions, lots, symbols, quotes, onClose, onBuy, onSell, onDone, setError }) {
  const [form, setForm] = useState({ symbol: '', date: today(), quantity: 100, price: '' }), [step, setStep] = useState(1), [allocations, setAllocations] = useState({}), [saving, setSaving] = useState(false)
  useEffect(() => { if (!mode) return; const symbol = mode.symbol || (mode.type === 'sell' ? positions[0]?.symbol : symbols[0]) || ''; const qty = mode.lotId ? Math.min(100, lots.find((lot) => lot.id === mode.lotId)?.remainingQty || 100) : 100; setForm({ symbol, date: today(), quantity: qty, price: quotes[symbol]?.ltp ?? '' }); setAllocations(mode.lotId ? { [mode.lotId]: qty } : {}); setStep(1) }, [mode])
  if (!mode) return null
  const selling = mode.type === 'sell', availableLots = lots.filter((lot) => lot.symbol === form.symbol && lot.remainingQty > 0), available = availableLots.reduce((s, lot) => s + Number(lot.remainingQty), 0), tx = { type: mode.type, quantity: form.quantity, price: form.price }, selected = Object.values(allocations).reduce((s, qty) => s + Number(qty || 0), 0), lotsById = Object.fromEntries(lots.map((lot) => [lot.id, lot])), reviewTx = { ...tx, allocations: Object.entries(allocations).filter(([, qty]) => qty > 0).map(([lotId, quantity]) => ({ lotId, quantity: Number(quantity) })) }, valid = form.symbol && form.date && Number(form.quantity) > 0 && Number(form.price) > 0 && (!selling || Number(form.quantity) <= available)
  const submit = async () => { setSaving(true); setError(''); try { if (selling) { await onSell({ ...form, allocations: reviewTx.allocations }); onDone('transactions') } else { await onBuy(form); onDone(`stock/${form.symbol}`) } } catch (error) { setError(error.message || 'The transaction could not be saved.') } finally { setSaving(false) } }
  return <Modal isOpen title={selling ? 'Record Sell Transaction' : 'Record Buy Transaction'} description={selling ? 'Allocate the exact shares sold against their purchase lots.' : 'A new purchase lot will be created for this transaction.'} onClose={onClose} footer={<div className="modal-actions">{step > 1 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}<button className="btn" onClick={onClose}>Cancel</button>{(!selling || step === 3) ? <button className="btn buy" disabled={!valid || saving || (selling && selected !== Number(form.quantity))} onClick={submit}>{saving ? 'Saving…' : selling ? 'Record Sale' : 'Record Buy'}</button> : <button className="btn buy" disabled={!valid || (step === 2 && selected !== Number(form.quantity))} onClick={() => setStep(step + 1)}>{step === 1 ? 'Select Purchase Lots' : 'Review Sale'}</button>}</div>}>
    {selling && <div className="steps"><span className={step >= 1 ? 'active' : ''}>1 Details</span><span className={step >= 2 ? 'active' : ''}>2 Lots</span><span className={step >= 3 ? 'active' : ''}>3 Review</span></div>}
    {step === 1 && <div className="form-grid"><label>Stock<select className="input" value={form.symbol} onChange={(e) => { const symbol = e.target.value; setForm({ ...form, symbol, price: quotes[symbol]?.ltp ?? '' }); setAllocations({}) }}>{(selling ? positions.map((p) => p.symbol) : symbols).map((symbol) => <option key={symbol}>{symbol}</option>)}</select></label><label>Trade date<input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label>Quantity<input className="input" type="number" min="1" max={selling ? available : undefined} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /><small>{selling ? `${number(available)} shares available` : ''}</small></label><label>Price per share<input className="input" type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label><Calculation tx={tx} /></div>}
    {selling && step === 2 && <div><p className="allocation-note">Allocate {number(form.quantity)} shares. Selected: <b>{number(selected)}</b></p><div className="lot-list">{availableLots.map((lot) => <label key={lot.id}><span><b>{prettyDate(lot.purchaseDate)}</b><small>{money(lot.price)} • {number(lot.remainingQty)} available</small></span><input className="input" type="number" min="0" max={lot.remainingQty} value={allocations[lot.id] || 0} onChange={(e) => setAllocations({ ...allocations, [lot.id]: Math.min(Number(e.target.value), lot.remainingQty) })} /></label>)}</div></div>}
    {selling && step === 3 && <div className="review-grid"><Calculation tx={tx} /><div className="calculation"><p><span>Selected lots</span><b>{reviewTx.allocations.length}</b></p><p><span>Allocated shares</span><b>{number(selected)}</b></p><p className="total"><span>Realized P/L</span><b>{money(realizedProfit(reviewTx, lotsById))}</b></p></div></div>}
  </Modal>
}

function Calculation({ tx }) { return <div className="calculation"><p><span>Gross amount</span><b>{money(grossAmount(tx))}</b></p><p><span>{tx.type === 'sell' ? 'Sell' : 'Buy'} commission (0.04%)</span><b>{money(commission(tx))}</b></p><p className="total"><span>{tx.type === 'sell' ? 'Net proceeds' : 'Total acquisition cost'}</span><b>{money(netAmount(tx))}</b></p></div> }
function PositionTable({ positions, navigate, setTrade }) { if (!positions.length) return <Empty title="No open positions" text="Record a buy transaction to create your first purchase lot." />; return <div className="table-wrap"><table><thead><tr><th>Symbol</th><th>LTP</th><th>Day</th><th>Quantity</th><th>Lots</th><th>Cost Basis</th><th>Market Value</th><th>Unrealized P/L</th><th>Return</th><th /></tr></thead><tbody>{positions.map((p) => <tr key={p.symbol}><td><button className="symbol-link" onClick={() => navigate(`stock/${p.symbol}`)}>{p.symbol}</button></td><td>{p.ltp == null ? '—' : money(p.ltp)}</td><td className={p.dayChange >= 0 ? 'positive' : 'negative'}>{p.dayChange == null ? '—' : money(p.dayChange)}</td><td>{number(p.quantity)}</td><td>{p.lots}</td><td>{money(p.cost)}</td><td>{p.marketValue == null ? '—' : money(p.marketValue)}</td><td className={p.unrealized >= 0 ? 'positive' : 'negative'}>{p.unrealized == null ? '—' : money(p.unrealized)}</td><td>{p.returnPct == null ? '—' : percent(p.returnPct)}</td><td><button className="btn small sell" onClick={() => setTrade({ type: 'sell', symbol: p.symbol })}>Sell</button></td></tr>)}</tbody></table></div> }
function TransactionTable({ transactions, lots, navigate, onDelete }) { const byId = Object.fromEntries(lots.map((lot) => [lot.id, lot])); if (!transactions.length) return <Empty title="No matching transactions" text="Record a buy or adjust the filters." />; return <div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Symbol</th><th>Quantity</th><th>Price</th><th>Gross</th><th>Commission</th><th>Net</th><th>Realized P/L</th><th>Source</th>{onDelete && <th>Actions</th>}</tr></thead><tbody>{transactions.map((tx) => { const pl = realizedProfit(tx, byId); return <tr key={tx.id}><td className={!tx.date ? 'warning' : ''}>{prettyDate(tx.date)}</td><td><Pill type={tx.type}>{tx.type}</Pill></td><td><button className="symbol-link" onClick={() => navigate(`stock/${tx.symbol}`)}>{tx.symbol}</button></td><td>{number(tx.quantity)}</td><td>{money(tx.price)}</td><td>{money(grossAmount(tx))}</td><td>{money(commission(tx))}</td><td>{money(netAmount(tx))}</td><td className={pl == null ? '' : pl >= 0 ? 'positive' : 'negative'}>{pl == null ? '—' : money(pl)}</td><td><Pill>{tx.source}</Pill></td>{onDelete && <td><button className="btn small delete" onClick={() => onDelete(tx)}>Delete</button></td>}</tr> })}</tbody></table></div> }
function Metrics({ items }) { return <div className="metrics">{items.map(([label, value, note, tone, onClick]) => <article className={`metric${onClick ? ' clickable' : ''}`} key={label} onClick={onClick} onKeyDown={onClick ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() } } : undefined} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}><span>{label}</span><strong className={tone == null ? '' : tone >= 0 ? 'positive' : 'negative'}>{value}</strong><small>{note}</small></article>)}</div> }
function PageHeader({ eyebrow, title, text, actions }) { return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{text}</p></div>{actions && <div className="header-actions">{actions}</div>}</header> }
function PanelHeader({ title, subtitle, action }) { return <div className="panel-header"><div><h3>{title}</h3><p>{subtitle}</p></div>{action}</div> }
function Pill({ children, type }) { return <span className={`pill ${type || ''}`}>{String(children).toUpperCase()}</span> }
function Empty({ title, text }) { return <div className="empty"><h3>{title}</h3><p>{text}</p></div> }
function Loading({ title, compact }) { return <div className={compact ? 'loading compact' : 'app-shell loading'}><i /><h2>{title}</h2></div> }
function sortTransactions(a, b) { if (!a.date && !b.date) return String(b.createdAt).localeCompare(String(a.createdAt)); if (!a.date) return 1; if (!b.date) return -1; return b.date.localeCompare(a.date) }
