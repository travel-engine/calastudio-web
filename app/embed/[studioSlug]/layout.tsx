import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Manrope } from 'next/font/google'
import { themeVars, fontHref } from '@/lib/studioTheme'
import { studioThemeForRequest } from '@/lib/resolveStudioTheme'

// The website widget (spec 09 §9.3): what public/widget.js loads in an iframe on a studio's own
// site. Same theme tokens + font as the studio tree (app/[studioSlug]/layout.tsx) but no StudioNav —
// the host page is the studio's website. Framing is allowed for this route only (next.config.ts).
const manrope = Manrope({ subsets: ['latin'], weight: ['300', '400', '500', '700'], variable: '--font-manrope' })

// The standalone site is the canonical, indexable copy of the schedule; the widget never is.
export const metadata: Metadata = { robots: { index: false, follow: false } }

interface Props {
  children: React.ReactNode
  params: Promise<{ studioSlug: string }>
}

export default async function EmbedLayout({ children, params }: Props) {
  const { studioSlug } = await params
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}`, { next: { revalidate: 60 } })
  if (res.status === 404) notFound()
  if (!res.ok) throw new Error('Failed to load studio')
  const org: { theme?: string | null } = await res.json()

  const theme = await studioThemeForRequest(org.theme)
  const themeFontHref = fontHref(theme)

  return (
    <div className={manrope.variable} style={{ ...themeVars(theme), position: 'relative' }} data-studio-theme={theme.key}>
      {themeFontHref && (
        <>
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link rel="stylesheet" href={themeFontHref} />
        </>
      )}
      {children}
    </div>
  )
}
