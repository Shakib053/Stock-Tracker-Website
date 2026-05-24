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
  isSubmitting = false,
  onClose,
  onSubmit,
}) {
  const [formValues, setFormValues] = useState(DEFAULT_FORM_VALUES)
  const [errors, setErrors] = useState({})

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
  }, [initialValues, isOpen])

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
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const nextErrors = {}
    const trimmedStockName = formValues.stockName.trim()
    const trimmedBuyingPrice = formValues.buyingPrice.trim()
    const trimmedQuantity = formValues.quantity.trim()
    const trimmedSoldPrice = formValues.soldPrice.trim()
    const buyingPrice = Number(trimmedBuyingPrice)
    const quantity = Number(trimmedQuantity)
    const soldPrice = trimmedSoldPrice === '' ? 0 : Number(trimmedSoldPrice)

    if (!trimmedStockName) {
      nextErrors.stockName = 'Stock name is required.'
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
      stockName: trimmedStockName,
      symbol: formValues.symbol.trim().toUpperCase(),
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
          <FormField
            label="Stock Name"
            name="stockName"
            value={formValues.stockName}
            onChange={handleChange}
            disabled={isSubmitting}
            placeholder="Example: Grameenphone"
            required
            error={errors.stockName}
          />

          <FormField
            label="DSE Trading Code"
            name="symbol"
            value={formValues.symbol}
            onChange={handleChange}
            disabled={isSubmitting}
            placeholder="Example: GP"
            error={errors.symbol}
          />
          <p className="-mt-3 text-xs leading-5 text-slate-400 sm:col-span-2">
            Required for live market value. Use the exact DSE code from dsebd.org (e.g. GP, BRACBANK,
            SQURPHARMA).
          </p>

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
