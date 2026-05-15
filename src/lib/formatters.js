const currencyFormatterCache = new Map()

export function formatCurrency(value, fractionDigits = 2) {
  const key = String(fractionDigits)

  if (!currencyFormatterCache.has(key)) {
    currencyFormatterCache.set(
      key,
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }),
    )
  }

  return currencyFormatterCache.get(key).format(Number(value) || 0)
}

export function formatPercent(value) {
  return `${Number(value) || 0}%`
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0)
}

export function getAmountTone(value) {
  const numericValue = Number(value) || 0

  if (numericValue > 0) {
    return 'text-success'
  }

  if (numericValue < 0) {
    return 'text-danger'
  }

  return 'text-slate-200'
}
