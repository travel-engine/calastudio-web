#!/usr/bin/env node
// Fails if any tracked source / content file contains a mojibake sequence — catches mangled text
// pasted into code, JSON fixtures or seed data. CI:  node scripts/check-mojibake.mjs
//
// Keep the regex in sync with lib/mojibake.ts (MOJIBAKE_RE) — a UTF-8 lead-byte char followed by
// the right number of continuation-byte chars.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const CONT = '[\\u0080-\\u00BF]'
const RE = new RegExp(
  `[\\u00C2-\\u00DF]${CONT}|[\\u00E0-\\u00EF]${CONT}{2}|[\\u00F0-\\u00F4]${CONT}{3}|\\uFFFD`,
)

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(ts|tsx|js|jsx|mjs|json|md|css)$/.test(f))

let bad = 0
for (const f of files) {
  let text
  try {
    text = readFileSync(f, 'utf8')
  } catch {
    continue
  }
  text.split('\n').forEach((line, i) => {
    if (RE.test(line)) {
      bad++
      console.error(`${f}:${i + 1}  ${line.trim().slice(0, 120)}`)
    }
  })
}

if (bad) {
  console.error(`\nx ${bad} line(s) look mojibake'd. Re-type the text or fix the encoding.`)
  process.exit(1)
}
console.log('ok - no mojibake in tracked files')
