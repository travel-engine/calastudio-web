'use client'

// "Install app" support for studio sites (PWA). Chrome/Edge/Samsung fire `beforeinstallprompt` once,
// early in the page load, when the site is installable; we keep that event so a button rendered
// later (booking success, account page) can open the browser's install dialog. iOS Safari has no
// such event: there we show Share → Add to Home Screen instructions instead.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(l => l())

/** Call once on the client (InstallCapture in the studio layout). Safe to call repeatedly. */
let started = false
export function startInstallCapture() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault() // keep Chrome's own mini-infobar from competing with our prompt
    deferred = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => { installed = true; deferred = null; notify() })
}

export function subscribeInstall(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export type InstallMode = 'prompt' | 'ios' | null

/** What we can offer on this device right now: a one-tap prompt, iOS instructions, or nothing. */
export function installMode(): InstallMode {
  if (typeof window === 'undefined' || installed) return null
  if (isStandalone() || isFramed()) return null
  if (deferred) return 'prompt'
  if (isIOS()) return 'ios'
  return null
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const e = deferred
  deferred = null
  await e.prompt()
  const { outcome } = await e.userChoice
  notify()
  return outcome === 'accepted'
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isFramed() {
  try { return window.self !== window.top } catch { return true }
}

function isIOS() {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}
