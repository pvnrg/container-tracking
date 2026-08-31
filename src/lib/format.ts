// Explicit locale so client components render identical text on the
// server (SSR) and in the browser regardless of each environment's
// default locale -- otherwise React throws a hydration mismatch.
const LOCALE = "en-GB"

export function formatDate(date: Date) {
  return date.toLocaleDateString(LOCALE)
}

export function formatDateTime(date: Date) {
  return date.toLocaleString(LOCALE)
}
