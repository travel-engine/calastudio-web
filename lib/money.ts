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
