'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, MapPin, X } from 'lucide-react'
import { STUDIO_SUBDOMAINS, studioUrl } from '@/lib/seo'
import { color, radius } from '@/lib/ui/tokens'
import { Button } from '@/app/components/admin'

// Home dashboard tip: add the schedule as the booking link on the studio's Google Business Profile
// (the quick win ahead of Reserve with Google, spec 11 §11.3). Shown to settings managers until
// they mark it done or close it. The choice is remembered per studio in this browser only; there is
// no server-side "dismissed tips" store yet.
const HELP = '/help/studio/getting-started/06-google-booking-link'
const storageKey = (orgId: string) => `cs-tip-google-link:${orgId}`

export default function GoogleLinkTip({ orgId, slug }: { orgId: string; slug: string }) {
  // Hidden until we've read storage, so a dismissed tip never flashes up.
  const [visible, setVisible] = useState(false)
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try { setVisible(localStorage.getItem(storageKey(orgId)) === null) } catch { setVisible(true) }
    // Off subdomains (local dev, previews) studioUrl is a path on this host.
    const url = studioUrl(slug, '/schedule')
    setLink(STUDIO_SUBDOMAINS ? url : `${window.location.origin}${url}`)
  }, [orgId, slug])

  const dismiss = (how: 'done' | 'closed') => {
    try { localStorage.setItem(storageKey(orgId), how) } catch { /* ignore */ }
    setVisible(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked — the link is selectable */ }
  }

  if (!visible || !link) return null

  return (
    <section aria-labelledby="google-tip-heading" style={{
      position: 'relative', background: color.infoBg, border: '1px solid #C9D8EE', borderRadius: radius.card,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <button type="button" aria-label="Hide this tip" onClick={() => dismiss('closed')} style={{
        position: 'absolute', top: 10, right: 10, width: 36, height: 36, border: 0, borderRadius: 8,
        background: 'transparent', color: color.infoInk, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <X size={18} aria-hidden />
      </button>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingRight: 36 }}>
        <MapPin size={20} strokeWidth={2} color={color.infoInk} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 id="google-tip-heading" style={{ margin: 0, fontSize: 17, fontWeight: 600, color: color.infoInk }}>
            Let people book from Google
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: color.ink2 }}>
            Add your schedule as the booking link on your Google Business Profile. People who find your studio on Google
            Search or Maps can go straight to booking. It takes about two minutes.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingLeft: 32 }}>
        <code style={{
          padding: '8px 12px', background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.control,
          fontSize: 14, color: color.ink, userSelect: 'all', wordBreak: 'break-all',
        }}>{link}</code>
        <Button size="sm" onClick={copy}>
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button size="sm" href={HELP}>How to add it</Button>
        <Button size="sm" onClick={() => dismiss('done')}>I’ve added it</Button>
      </div>
    </section>
  )
}
