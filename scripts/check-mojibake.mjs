#!/usr/bin/env node
// Fails if any tracked source / content file contains a literal mojibake sequence — catches
// mangled text pasted into code, JSON fixtures, or seed data. Wire into CI:  node scripts/check-mojibake.mjs
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const RE = /[ÂÃâ][-¿–—‘’“”… ]/

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(ts|tsx|js|jsx|json|md|css)$/.test(f))

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
  console.error(`\n✗ ${bad} line(s) look mojibake'd. Re-type the text or fix the encoding.`)
  process.exit(1)
}
console.log('✓ no mojibake in tracked files')
