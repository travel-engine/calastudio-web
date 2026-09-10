// Detection for "mojibake" — text that was UTF-8, got decoded as Latin-1/CP1252 somewhere, and
// re-encoded as UTF-8. The tell-tale is a byte in U+00C2–U+00C3 (or the `â€` family) sitting
// directly in front of another high-Latin-1 byte or a smart-punctuation char.
//
// This is a *canary*, not a fix. The authoritative fix belongs on the backend (charset on the DB
// connection / column, or a bad decode in request handling) plus a round-trip test in its CI.
// `demojibake` exists only for a deliberate one-time data repair — never call it on render, it can
// corrupt legitimately Latin-1-range text.

// `Â`/`Ã`/`â` immediately followed by a continuation byte, a smart quote/dash, or nbsp.
export const MOJIBAKE_RE =
  /[ÂÃâ][-¿ –—‘’“”…]/

export function looksLikeMojibake(value: unknown): boolean {
  return typeof value === 'string' && MOJIBAKE_RE.test(value)
}

/** Best-effort repair of a single round of double-encoding. One-time migrations only. */
export function demojibake(s: string): string {
  try {
    // Re-interpret the current code points as Latin-1 bytes, then decode as UTF-8.
    const bytes = Uint8Array.from([...s].map((c) => c.charCodeAt(0) & 0xff))
    const fixed = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return MOJIBAKE_RE.test(fixed) ? s : fixed
  } catch {
    return s
  }
}

/** Walk an object/array and return the dotted paths of every string value that looks mojibake'd. */
export function scanForMojibake(input: unknown, path = ''): string[] {
  if (typeof input === 'string') return MOJIBAKE_RE.test(input) ? [path || '(root)'] : []
  if (Array.isArray(input)) return input.flatMap((v, i) => scanForMojibake(v, `${path}[${i}]`))
  if (input && typeof input === 'object') {
    return Object.entries(input).flatMap(([k, v]) => scanForMojibake(v, path ? `${path}.${k}` : k))
  }
  return []
}
