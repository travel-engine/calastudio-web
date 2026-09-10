// Detection for corrupted text — primarily "mojibake": text that was UTF-8, got decoded as
// Latin-1 / CP1252 somewhere, and re-encoded as UTF-8 (e.g. "middot" -> "A-hat + middot",
// em-dash and curly quotes -> "a-hat + euro + ...", emoji -> "eth + y-diaeresis + ...").
//
// The signature is structural, not a character list: a byte value in the UTF-8 *lead-byte* range
// (0xC2-0xF4) sitting directly in front of the right number of *continuation-byte* values
// (0x80-0xBF). That adjacency essentially never appears in genuine text — it only shows up when
// real UTF-8 bytes were decoded one byte per char. Any accented letter, dash, quote, ellipsis,
// currency sign or emoji that gets double-encoded produces it.
//
// This is a *canary*. The real fix is server-side (DB connection/column charset, or a bad decode
// in request handling) plus a non-ASCII round-trip test in the API's CI. `demojibake` is for a
// deliberate one-time data repair only — never call it on render.

const LEAD2 = '[\\u00C2-\\u00DF]'
const LEAD3 = '[\\u00E0-\\u00EF]'
const LEAD4 = '[\\u00F0-\\u00F4]'
const CONT = '[\\u0080-\\u00BF]'

/** Lead-byte char followed by the right number of continuation-byte chars (2/3/4-byte forms). */
export const MOJIBAKE_RE = new RegExp(
  `${LEAD2}${CONT}|${LEAD3}${CONT}{2}|${LEAD4}${CONT}{3}`,
)

/** U+FFFD replacement char — a decode that already gave up. Different failure, still corrupt. */
export const REPLACEMENT_RE = /\uFFFD/

/** Best-effort undo of double-encoding (repeats up to 3x). One-time data repair only. */
export function demojibake(s: string): string {
  let out = s
  for (let i = 0; i < 3; i++) {
    if (!MOJIBAKE_RE.test(out)) break
    try {
      const bytes = Uint8Array.from([...out].map((c) => c.charCodeAt(0) & 0xff))
      out = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      break
    }
  }
  return out
}

/**
 * True when a string carries the structural mojibake signature *and* re-decoding actually changes
 * it — guards against the rare coincidental byte pattern.
 */
export function looksLikeMojibake(value: unknown): boolean {
  if (typeof value !== 'string' || !MOJIBAKE_RE.test(value)) return false
  return demojibake(value) !== value
}

/** Any encoding problem: confirmed mojibake, or a U+FFFD replacement char. */
export function hasEncodingIssue(value: unknown): boolean {
  return typeof value === 'string' && (looksLikeMojibake(value) || REPLACEMENT_RE.test(value))
}

/** Walk an object/array; return the dotted paths of every string with an encoding problem. */
export function scanForMojibake(input: unknown, path = ''): string[] {
  if (typeof input === 'string') return hasEncodingIssue(input) ? [path || '(root)'] : []
  if (Array.isArray(input)) return input.flatMap((v, i) => scanForMojibake(v, `${path}[${i}]`))
  if (input && typeof input === 'object') {
    return Object.entries(input).flatMap(([k, v]) => scanForMojibake(v, path ? `${path}.${k}` : k))
  }
  return []
}
