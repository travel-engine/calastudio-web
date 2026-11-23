// Money in the dashboard: always the org's currency, never an assumed "$" (CLAUDE.md).
// en-US formatting labels every non-USD dollar ("A$6.00", "NZ$6.00"), which is what the admin
// redesign asks for (handoff §3) and keeps an AUD price from reading as US dollars.
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

/** Whole units for headline figures ("A$1,240"); cents shown only when the amount has them under 100. */
export function formatMoneyShort(amount: number, currency: string): string {
  const whole = Math.abs(amount) >= 100 || Number.isInteger(amount)
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: whole ? 0 : 2, minimumFractionDigits: whole ? 0 : 2 }).format(amount)
  } catch {
    return formatMoney(amount, currency)
  }
}
