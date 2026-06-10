import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_FORM_VALUES, STATUS_OPTIONS } from '../lib/constants'
import { calculateDerivedValues } from '../lib/stockMath'
import { formatCurrency, formatPercent } from '../lib/formatters'
import Modal from './Modal'

function StockFormModal({
  isOpen,
  title,
  description,
  submitLabel,
  initialValues = DEFAULT_FORM_VALUES,
  symbolOptions = [],
  isSubmitting = false,
  onClose,
  onSubmit,
}) {
  const [formValues, setFormValues] = useState(DEFAULT_FORM_VALUES)
  const [errors, setErrors] = useState({})
  const [isSymbolMenuOpen, setIsSymbolMenuOpen] = useState(false)
  const [activeSymbolIndex, setActiveSymbolIndex] = useState(0)
  const normalizedSymbolOptions = useMemo(() => {
    return symbolOptions.map((symbol) => String(symbol).trim().toUpperCase())
  }, [symbolOptions])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setFormValues({
      stockName: initialValues.stockName ?? '',
      symbol: initialValues.symbol ?? '',
      buyingPrice: String(initialValues.buyingPrice ?? ''),
      quantity: String(initialValues.quantity ?? ''),
      soldPrice: String(initialValues.soldPrice ?? ''),
      status: initialValues.status ?? 'holding',
    })
    setErrors({})
    setIsSymbolMenuOpen(false)
    setActiveSymbolIndex(0)
  }, [initialValues, isOpen])

  const symbolSuggestions = useMemo(() => {
    const query = formValues.symbol.trim().toUpperCase()

    if (!query) {
      return normalizedSymbolOptions.slice(0, 8)
    }

    return normalizedSymbolOptions
      .filter((symbol) => symbol.includes(query))
      .sort((left, right) => {
        const leftStarts = left.startsWith(query)
        const rightStarts = right.startsWith(query)

        if (leftStarts !== rightStarts) {
          return leftStarts ? -1 : 1
        }

        return left.localeCompare(right)
      })
      .slice(0, 8)
  }, [formValues.symbol, normalizedSymbolOptions])

  const liveValues = useMemo(() => {
    return calculateDerivedValues({
      buyingPrice: Number(formValues.buyingPrice) || 0,
      quantity: Number(formValues.quantity) || 0,
      soldPrice: Number(formValues.soldPrice) || 0,
    })
  }, [formValues.buyingPrice, formValues.quantity, formValues.soldPrice])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormValues((currentValues) => ({ ...currentValues, [name]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [name]: undefined }))

    if (name === 'symbol') {
      setIsSymbolMenuOpen(true)
      setActiveSymbolIndex(0)
    }
  }

  const chooseSymbol = (symbol) => {
    setFormValues((currentValues) => ({ ...currentValues, symbol }))
    setErrors((currentErrors) => ({ ...currentErrors, symbol: undefined }))
    setIsSymbolMenuOpen(false)
    setActiveSymbolIndex(0)
  }

  const handleSymbolKeyDown = (event) => {
    if (!isSymbolMenuOpen || symbolSuggestions.length === 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        setIsSymbolMenuOpen(true)
      }

      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveSymbolIndex((currentIndex) => (currentIndex + 1) % symbolSuggestions.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveSymbolIndex((currentIndex) =>
        currentIndex === 0 ? symbolSuggestions.length - 1 : currentIndex - 1,
      )
      return
    }

    if (event.key === 'Enter' && symbolSuggestions[activeSymbolIndex]) {
      event.preventDefault()
      chooseSymbol(symbolSuggestions[activeSymbolIndex])
      return
    }

    if (event.key === 'Escape') {
      setIsSymbolMenuOpen(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const nextErrors = {}
    const trimmedBuyingPrice = formValues.buyingPrice.trim()
    const trimmedQuantity = formValues.quantity.trim()
    const trimmedSoldPrice = formValues.soldPrice.trim()
    const trimmedSymbol = formValues.symbol.trim().toUpperCase()
    const buyingPrice = Number(trimmedBuyingPrice)
    const quantity = Number(trimmedQuantity)
    const soldPrice = trimmedSoldPrice === '' ? 0 : Number(trimmedSoldPrice)

    if (!trimmedSymbol) {
      nextErrors.symbol = 'DSE trading code is required.'
    } else if (normalizedSymbolOptions.length > 0 && !normalizedSymbolOptions.includes(trimmedSymbol)) {
      nextErrors.symbol = 'Choose a valid DSE trading code from the list.'
    }

    if (!trimmedBuyingPrice) {
      nextErrors.buyingPrice = 'Buying price is required.'
    } else if (Number.isNaN(buyingPrice) || buyingPrice < 0) {
      nextErrors.buyingPrice = 'Buying price must be a non-negative number.'
    }

    if (!trimmedQuantity) {
      nextErrors.quantity = 'Quantity is required.'
    } else if (Number.isNaN(quantity) || quantity <= 0) {
      nextErrors.quantity = 'Quantity must be greater than zero.'
    }

    if (Number.isNaN(soldPrice) || soldPrice < 0) {
      nextErrors.soldPrice = 'Sold price must be a non-negative number.'
    }

    if (!STATUS_OPTIONS.some((option) => option.value === formValues.status)) {
      nextErrors.status = 'Select a valid status.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    onSubmit({
      symbol: trimmedSymbol,
      buyingPrice,
      quantity,
      soldPrice,
      status: formValues.status,
    })
  }

  const footer = (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="action-button border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="stock-form"
        disabled={isSubmitting}
        className="action-button bg-accent text-slate-950 hover:bg-sky-300"
      >
        {isSubmitting ? 'Saving...' : submitLabel}
      </button>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      description={description}
      onClose={onClose}
      footer={footer}
    >
      <form id="stock-form" className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="relative sm:col-span-2">
            <label className="field-label" htmlFor="symbol">
              DSE Trading Code
              <span className="ml-1 text-danger">*</span>
            </label>
            <input
              id="symbol"
              name="symbol"
              value={formValues.symbol}
              onChange={handleChange}
              onFocus={() => setIsSymbolMenuOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setIsSymbolMenuOpen(false), 120)
              }}
              onKeyDown={handleSymbolKeyDown}
              disabled={isSubmitting}
              placeholder="Start typing a DSE code"
              autoComplete="off"
              className="field-input"
            />
            {errors.symbol ? <p className="mt-2 text-sm text-danger">{errors.symbol}</p> : null}
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Search the prefetched DSE list as you type. Select a code to keep the live price
              lookup accurate.
            </p>

            {isSymbolMenuOpen && symbolSuggestions.length > 0 ? (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-glow backdrop-blur">
                {symbolSuggestions.map((symbol, index) => (
                  <button
                    key={symbol}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      chooseSymbol(symbol)
                    }}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${
                      index === activeSymbolIndex
                        ? 'bg-sky-400/10 text-sky-200'
                        : 'text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <span className="font-semibold uppercase tracking-wide">{symbol}</span>
                    <span className="text-xs text-slate-500">DSE code</span>
                  </button>
                ))}
              </div>
            ) : null}

            {isSymbolMenuOpen && formValues.symbol.trim() && symbolSuggestions.length === 0 ? (
              <div className="absolute z-20 mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 text-sm text-slate-400 shadow-glow backdrop-blur">
                No matching DSE code found.
              </div>
            ) : null}
          </div>

          <div>
            <label className="field-label" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formValues.status}
              onChange={handleChange}
              disabled={isSubmitting}
              className="field-input"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.status ? <p className="mt-2 text-sm text-danger">{errors.status}</p> : null}
          </div>

          <FormField
            label="Buying Price"
            name="buyingPrice"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.001"
            value={formValues.buyingPrice}
            onChange={handleChange}
            disabled={isSubmitting}
            placeholder="0.000"
            required
            error={errors.buyingPrice}
          />

          <FormField
            label="Quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={formValues.quantity}
            onChange={handleChange}
            disabled={isSubmitting}
            placeholder="0"
            required
            error={errors.quantity}
          />

          <FormField
            label="Sold Price"
            name="soldPrice"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.001"
            value={formValues.soldPrice}
            onChange={handleChange}
            disabled={isSubmitting}
            placeholder="0.000"
            error={errors.soldPrice}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-sm font-semibold text-white">Live Preview</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PreviewCard
              label="Including Commission"
              value={formatCurrency(liveValues.includingCommission, 3)}
            />
            <PreviewCard
              label="Min Selling Price"
              value={formatCurrency(liveValues.minSellingPrice, 3)}
            />
            <PreviewCard label="Profit %" value={formatPercent(liveValues.profitPercent)} />
            <PreviewCard label="Amount" value={formatCurrency(liveValues.amount, 0)} />
          </div>
        </div>
      </form>
    </Modal>
  )
}

function FormField({ label, error, required = false, ...inputProps }) {
  return (
    <div>
      <label className="field-label" htmlFor={inputProps.name}>
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </label>
      <input id={inputProps.name} className="field-input" {...inputProps} />
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  )
}

function PreviewCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
    </div>
  )
}

export default StockFormModal
