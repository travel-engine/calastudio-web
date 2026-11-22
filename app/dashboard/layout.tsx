import { adminBody as body, adminDisplay as display } from '@/lib/fonts'
import SessionPolicyGuard from '@/app/components/SessionPolicyGuard'
import DashboardAccessGuard from '@/app/components/DashboardAccessGuard'
import TermsUpdatePrompt from '@/app/components/TermsUpdatePrompt'
import { InstallCapture } from '@/app/[studioSlug]/InstallAppPrompt'
import { color, font } from '@/lib/ui/tokens'

// Admin typefaces (design/admin-redesign handoff §3), scoped to the dashboard tree: Figtree for body
// and UI, Instrument Serif for page titles only. Exposed as CSS variables that lib/ui/tokens `font`
// reads, so the public studio site and its themes are untouched.

// Wraps every authenticated dashboard route so the "remember me" session cap (lib/authRemember)
// is enforced no matter which page the user lands on first.
//
// Installable as the "CalaStudio" staff app (app/dashboard/app-manifest): manifest and iOS
// home-screen tags rendered as tags, which React hoists into <head>, as in the studio layout.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${body.variable} ${display.variable}`} style={{ fontFamily: font.body, color: color.ink, minHeight: '100vh', background: color.bg }}>
      <link rel="manifest" href="/dashboard/app-manifest" />
      <link rel="apple-touch-icon" href="/dashboard/app-icon/180" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="CalaStudio" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="theme-color" content={color.bg} />
      <InstallCapture />
      <SessionPolicyGuard />
      <TermsUpdatePrompt />
      <DashboardAccessGuard>{children}</DashboardAccessGuard>
    </div>
  )
}
