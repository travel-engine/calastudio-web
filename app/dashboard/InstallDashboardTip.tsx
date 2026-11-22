'use client'

import { useEffect, useState } from 'react'
import { Share, SquarePlus, Smartphone, X } from 'lucide-react'
import { installMode, promptInstall, startInstallCapture, subscribeInstall, type InstallMode } from '@/lib/installPrompt'
import { color, radius } from '@/lib/ui/tokens'
import { Button } from '@/app/components/admin'

// Home dashboard tip: install the dashboard as an app (PWA, app/dashboard/app-manifest). A one-tap
// Install where the browser supports it (Android Chrome, desktop Chrome/Edge), Share → Add to Home
// Screen steps on iPhone/iPad, nothing when already installed or unsupported. Closing it hides it in
// this browser for 30 days. Shown to every staff role: teachers checking in on their phone gain most.

const DISMISS_DAYS = 30
const KEY = 'cs-install-dismissed:dashboard'

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(KEY))
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000
  } catch { return false }
}

export default function InstallDashboardTip() {
  const [mode, setMode] = useState<InstallMode>(null)
  const [hidden, setHidden] = useState(true)
  const [showSteps, setShowSteps] = useState(false)

  useEffect(() => {
    startInstallCapture()
    setHidden(recentlyDismissed())
    const update = () => setMode(installMode())
    update()
    return subscribeInstall(update)
  }, [])

  if (hidden || !mode) return null

  const dismiss = () => {
    try { localStorage.setItem(KEY, String(Date.now())) } catch { /* ignore */ }
    setHidden(true)
  }

  return (
    <section aria-labelledby="install-tip-heading" style={{
      position: 'relative', background: color.infoBg, border: '1px solid #C9D8EE', borderRadius: radius.card,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <button type="button" aria-label="Hide this tip" onClick={dismiss} style={{
        position: 'absolute', top: 10, right: 10, width: 36, height: 36, border: 0, borderRadius: 8,
        background: 'transparent', color: color.infoInk, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <X size={18} aria-hidden />
      </button>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingRight: 36 }}>
        <Smartphone size={20} strokeWidth={2} color={color.infoInk} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 id="install-tip-heading" style={{ margin: 0, fontSize: 17, fontWeight: 600, color: color.infoInk }}>
            Put CalaStudio on your home screen
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: color.ink2 }}>
            Open your schedule, rosters and check-ins in one tap. It works like an app, with no app store download.
          </p>
        </div>
      </div>

      {mode === 'ios' && showSteps && (
        <ol style={{ margin: 0, paddingLeft: 52, fontSize: 15, lineHeight: 1.6, color: color.ink2 }}>
          <li>Tap <Share size={15} aria-label="Share" style={{ verticalAlign: '-2px' }} /> <strong>Share</strong> in Safari&rsquo;s toolbar.</li>
          <li>Scroll down and tap <SquarePlus size={15} aria-hidden style={{ verticalAlign: '-2px' }} /> <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong>, then sign in once inside the app.</li>
        </ol>
      )}

      <div style={{ paddingLeft: 32 }}>
        <Button size="sm" onClick={() => (mode === 'ios' ? setShowSteps(s => !s) : promptInstall())}>
          {mode === 'ios' ? (showSteps ? 'Hide steps' : 'Show me how') : 'Install app'}
        </Button>
      </div>
    </section>
  )
}
