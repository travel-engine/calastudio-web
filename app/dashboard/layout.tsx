import { Figtree, Instrument_Serif } from 'next/font/google'
import SessionPolicyGuard from '@/app/components/SessionPolicyGuard'
import { color, font } from '@/lib/ui/tokens'

// Admin typefaces (design/admin-redesign handoff §3), scoped to the dashboard tree: Figtree for body
// and UI, Instrument Serif for page titles only. Exposed as CSS variables that lib/ui/tokens `font`
// reads, so the public studio site and its themes are untouched.
const body = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-admin-body' })
const display = Instrument_Serif({ subsets: ['latin'], weight: '400', display: 'swap', variable: '--font-admin-display' })

// Wraps every authenticated dashboard route so the "remember me" session cap (lib/authRemember)
// is enforced no matter which page the user lands on first.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${body.variable} ${display.variable}`} style={{ fontFamily: font.body, color: color.ink, minHeight: '100vh', background: color.bg }}>
      <SessionPolicyGuard />
      {children}
    </div>
  )
}
