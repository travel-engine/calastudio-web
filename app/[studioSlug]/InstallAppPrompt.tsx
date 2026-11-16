'use client'

import { useEffect, useState } from 'react'
import { Share, SquarePlus, Smartphone, X } from 'lucide-react'
import { installMode, promptInstall, startInstallCapture, subscribeInstall, type InstallMode } from '@/lib/installPrompt'

// Mounted once in the studio layout: starts listening for the browser's install event as early as
// possible (it fires once, during page load).
export function InstallCapture() {
  useEffect(() => { startInstallCapture() }, [])
  return null
}

const DISMISS_DAYS = 30
const dismissKey = (slug: string) => `cs-install-dismissed:${slug}`

function recentlyDismissed(slug: string) {
  try {
    const at = Number(localStorage.getItem(dismissKey(slug)))
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000
  } catch { return false }
}

/**
 * "Add {studio} to your home screen" — a one-tap Install button where the browser supports it
 * (Android Chrome etc.), Share → Add to Home Screen steps on iPhone/iPad, and nothing otherwise
 * (already installed, inside the website widget, desktop browsers without install support).
 * Dismissing hides it on this device for 30 days.
 */
export default function InstallAppPrompt({ studioSlug, studioName }: { studioSlug: string; studioName?: string }) {
  const [mode, setMode] = useState<InstallMode>(null)
  const [hidden, setHidden] = useState(true)
  const [showSteps, setShowSteps] = useState(false)

  useEffect(() => {
    startInstallCapture()
    setHidden(recentlyDismissed(studioSlug))
    const update = () => setMode(installMode())
    update()
    return subscribeInstall(update)
  }, [studioSlug])

  if (hidden || !mode) return null

  const dismiss = () => {
    try { localStorage.setItem(dismissKey(studioSlug), String(Date.now())) } catch { /* ignore */ }
    setHidden(true)
  }

  const install = async () => {
    if (mode === 'ios') { setShowSteps(s => !s); return }
    await promptInstall()
  }

  const what = studioName ? `Add ${studioName} to your home screen` : 'Add us to your home screen'

  return (
    <section aria-label="Install the app" style={{
      position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px',
      background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--radius, 12px)',
      fontFamily: 'var(--font-body)', textAlign: 'left',
    }}>
      <button type="button" onClick={dismiss} aria-label="Not now" style={{
        position: 'absolute', top: 6, right: 6, width: 36, height: 36, border: 0, background: 'transparent',
        color: 'var(--text-meta)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <X size={18} aria-hidden />
      </button>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingRight: 32 }}>
        <Smartphone size={22} aria-hidden style={{ flex: 'none', marginTop: 1 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{what}</div>
          <div style={{ fontSize: 14, lineHeight: 1.4, color: 'var(--text-body)', marginTop: 2 }}>
            Book your next class in a tap — it opens like an app, no download from the app store.
          </div>
        </div>
      </div>

      {mode === 'ios' && showSteps && (
        <ol style={{ margin: '0 0 0 34px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: 'var(--text-body)' }}>
          <li>Tap <Share size={15} aria-label="Share" style={{ verticalAlign: '-2px' }} /> <strong>Share</strong> in Safari&rsquo;s toolbar.</li>
          <li>Scroll down and tap <SquarePlus size={15} aria-hidden style={{ verticalAlign: '-2px' }} /> <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong>.</li>
        </ol>
      )}

      <button type="button" onClick={install} style={{
        alignSelf: 'flex-start', marginLeft: 34, minHeight: 44, padding: '0 18px', border: 0, borderRadius: 'var(--pill, 999px)',
        background: 'var(--accent)', color: 'var(--accent-ink)', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer',
      }}>
        {mode === 'ios' ? (showSteps ? 'Hide steps' : 'Show me how') : 'Install app'}
      </button>
    </section>
  )
}
