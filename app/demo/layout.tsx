import type { Metadata } from 'next'
import { adminBody as body, adminDisplay as display } from '@/lib/fonts'
import { color, font } from '@/lib/ui/tokens'

// "Try the demo" (spec 19 §19.4). Same typefaces as the dashboard, which is where most visitors go next.
export const metadata: Metadata = {
  title: 'Try the demo',
  description: 'Explore a sample yoga and Pilates studio on CalaStudio as its owner, a teacher or a member.',
  robots: { index: false, follow: false },
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${body.variable} ${display.variable}`} style={{ fontFamily: font.body, color: color.ink, minHeight: '100vh', background: color.bg }}>
      {children}
    </div>
  )
}
