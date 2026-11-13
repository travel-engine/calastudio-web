'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { SITE_URL, studioUrl } from '@/lib/seo'
import { color, radius, space } from '@/lib/ui/tokens'
import { Button, Field, Segmented, Toggle, cardStyle, controlStyle } from '@/app/components/admin'

// Settings → Website widget (spec 09 §9.3): builds the one-line script tag for public/widget.js,
// shows a live preview (the real /embed page in an iframe) and how to paste it on each website
// builder. Nothing here is saved — every option lives in the snippet itself.

type Style = 'inline' | 'popup'
type Platform = 'wordpress' | 'squarespace' | 'wix' | 'webflow' | 'showit' | 'other'

const DEFAULT_BUTTON = 'Book a class'
const HEX = /^#[0-9a-fA-F]{6}$/
const HELP = '/help/studio/getting-started/05-add-booking-to-your-website'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'wordpress', label: 'WordPress' },
  { value: 'squarespace', label: 'Squarespace' },
  { value: 'wix', label: 'Wix' },
  { value: 'webflow', label: 'Webflow' },
  { value: 'showit', label: 'Showit' },
  { value: 'other', label: 'Other' },
]

// Where to paste, per builder and style. Keep in step with the help article (HELP).
const STEPS: Record<Platform, Record<Style, string[]>> = {
  wordpress: {
    inline: ['Edit the page where you want your schedule.', 'Add a Custom HTML block.', 'Paste the code into it, then update the page.'],
    popup: ['Go to Appearance → Editor (or Widgets) and open your footer.', 'Add a Custom HTML block.', 'Paste the code into it and save. The button appears on every page.'],
  },
  squarespace: {
    inline: ['Edit the page where you want your schedule.', 'Add a Code block.', 'Paste the code into it and save.'],
    popup: ['Go to Settings → Advanced → Code Injection.', 'Paste the code into Footer.', 'Save. The button appears on every page.'],
  },
  wix: {
    inline: ['In the editor, click Add → Embed Code → Embed HTML.', 'Choose Code, paste the code and click Update.', 'Make the box tall — Wix shows embedded code in a fixed-size box. Then publish.'],
    popup: ['Go to Settings → Custom Code and click Add Custom Code.', 'Paste the code, choose All pages and Body – end.', 'Apply, then publish. Custom code needs a paid Wix plan.'],
  },
  webflow: {
    inline: ['Drag a Code Embed element onto the page.', 'Paste the code and save.', 'Publish the site.'],
    popup: ['Open Site settings → Custom code.', 'Paste the code into Footer code.', 'Save and publish.'],
  },
  showit: {
    inline: ['Add an Embed Code element where you want your schedule.', 'Paste the code into it.', 'Publish.'],
    popup: ['Open the site settings for code that loads on every page.', 'Paste the code into the footer section.', 'Publish.'],
  },
  other: {
    inline: ['Open the page’s HTML.', 'Paste the code where you want your schedule to appear.', 'Save and publish.'],
    popup: ['Paste the code just before </body> on every page (most sites have a shared footer).', 'Save and publish.'],
  },
}

export default function WidgetTab({ slug, brandColor }: { slug: string; brandColor: string }) {
  const [style, setStyle] = useState<Style>('inline')
  const [platform, setPlatform] = useState<Platform>('wordpress')
  const [customColor, setCustomColor] = useState(false)
  const [widgetColor, setWidgetColor] = useState(brandColor || '#085041')
  const [floating, setFloating] = useState(true)
  const [buttonText, setButtonText] = useState(DEFAULT_BUTTON)
  const [copied, setCopied] = useState(false)

  const colorValue = customColor && HEX.test(widgetColor) ? widgetColor : null

  const code = useMemo(() => {
    const attrs = [`src="${SITE_URL}/widget.js"`, `data-studio="${slug}"`]
    if (style === 'popup') attrs.push('data-mode="popup"')
    if (colorValue) attrs.push(`data-color="${colorValue}"`)
    if (style === 'popup' && !floating) attrs.push('data-button="false"')
    else if (style === 'popup' && buttonText.trim() && buttonText.trim() !== DEFAULT_BUTTON) {
      attrs.push(`data-button="${buttonText.trim().replace(/"/g, '&quot;')}"`)
    }
    attrs.push('async')
    return attrs.length > 3 ? `<script\n  ${attrs.join('\n  ')}>\n</script>` : `<script ${attrs.join(' ')}></script>`
  }, [slug, style, colorValue, floating, buttonText])

  const previewSrc = useMemo(() => {
    const q = new URLSearchParams()
    if (colorValue) q.set('color', colorValue)
    if (style === 'popup') q.set('popup', '1')
    const qs = q.toString()
    return `/embed/${slug}${qs ? `?${qs}` : ''}`
  }, [slug, colorValue, style])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the code is selectable in the box */
    }
  }

  if (!slug) return <div style={{ ...cardStyle, padding: 24, color: color.muted }}>Loading…</div>

  const btnColor = colorValue ?? brandColor ?? color.primary

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.cardGap, alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
        <section aria-labelledby="w-intro" style={{ ...cardStyle, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: space.formGap }}>
          <div>
            <h2 id="w-intro" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Add booking to your website</h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: color.muted, lineHeight: 1.45 }}>
              Paste one line of code into your website and members can browse, pay and book without leaving it.
              Your booking page at <a href={studioUrl(slug)} target="_blank" rel="noopener" style={{ color: color.primaryInk }}>{studioUrl(slug).replace(/^https?:\/\//, '')}</a> keeps working too.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Style</span>
            <Segmented label="Widget style" value={style} onChange={setStyle} options={[
              { value: 'inline', label: 'Schedule on a page' },
              { value: 'popup', label: 'Book button' },
            ]} />
            <span style={{ fontSize: 13, color: color.muted, lineHeight: 1.4 }}>
              {style === 'inline'
                ? 'Your class list sits inside a page of your website and sizes itself to fit.'
                : 'A button floats on every page and opens your schedule full-screen — best when most members visit on their phones.'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Toggle checked={customColor} onChange={setCustomColor} label="Use a different colour from my booking page" />
            {customColor && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="color" aria-label="Pick widget colour" value={HEX.test(widgetColor) ? widgetColor : '#085041'} onChange={e => setWidgetColor(e.target.value)}
                  style={{ width: 44, height: 44, padding: 0, border: `1px solid ${color.control}`, borderRadius: radius.control, background: 'none', cursor: 'pointer' }} />
                <input aria-label="Widget colour hex" value={widgetColor} onChange={e => setWidgetColor(e.target.value)} style={{ ...controlStyle, maxWidth: 140 }} />
              </div>
            )}
          </div>

          {style === 'popup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Toggle checked={floating} onChange={setFloating} label="Show a floating button" />
              {floating ? (
                <Field label="Button text" htmlFor="w-btn">
                  <input id="w-btn" value={buttonText} maxLength={30} onChange={e => setButtonText(e.target.value)} style={{ ...controlStyle, maxWidth: 280 }} />
                </Field>
              ) : (
                <span style={{ fontSize: 13, color: color.muted, lineHeight: 1.4 }}>
                  Use your own buttons instead: add <code>data-calastudio-open</code> to any button or link on your site, e.g.{' '}
                  <code>{'<a href="#" data-calastudio-open>Book now</a>'}</code>
                </span>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="w-code" style={{ ...cardStyle, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: space.formGap }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h2 id="w-code" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Your code</h2>
            <Button size="sm" onClick={copy}>
              {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {copied ? 'Copied' : 'Copy code'}
            </Button>
          </div>
          <pre aria-label="Widget code" style={{
            margin: 0, padding: '14px 16px', background: color.bg, border: `1px solid ${color.border}`, borderRadius: radius.control,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 13, lineHeight: 1.55,
            whiteSpace: 'pre-wrap', wordBreak: 'break-all', userSelect: 'all', color: color.ink,
          }}>{code}</pre>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Where to paste it</span>
            <Segmented label="Website builder" size="sm" value={platform} onChange={setPlatform} options={PLATFORMS} />
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15, lineHeight: 1.45 }}>
              {STEPS[platform][style].map(s => <li key={s}>{s}</li>)}
            </ol>
            <a href={HELP} target="_blank" rel="noopener" style={{ fontSize: 14, color: color.primaryInk, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Full guide, options and booking tracking <ExternalLink size={14} aria-hidden />
            </a>
          </div>
        </section>
      </div>

      <section aria-labelledby="w-preview" style={{ ...cardStyle, flex: '1 1 380px', minWidth: 0, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 id="w-preview" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Preview</h2>
          <a href={previewSrc} target="_blank" rel="noopener" style={{ fontSize: 14, color: color.primaryInk, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Open full size <ExternalLink size={14} aria-hidden />
          </a>
        </div>
        {style === 'popup' && floating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: color.muted }}>
            <span style={{
              display: 'inline-block', padding: '10px 16px', borderRadius: 999, background: btnColor, color: '#fff',
              fontSize: 14, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,.2)',
            }}>{buttonText.trim() || DEFAULT_BUTTON}</span>
            sits in the corner of your site and opens:
          </div>
        )}
        <iframe
          key={previewSrc}
          src={previewSrc}
          title="Widget preview"
          style={{ width: '100%', height: 560, border: `1px solid ${color.border}`, borderRadius: radius.control, background: color.bg }}
        />
        <span style={{ fontSize: 13, color: color.muted, lineHeight: 1.4 }}>
          This is live — booking here makes a real booking. The look follows your page style in the Booking page tab.
        </span>
      </section>
    </div>
  )
}
