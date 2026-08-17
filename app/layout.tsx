import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CalaStudio — Your sessions. Your rules. Your members.',
  description: 'Session management and dynamic pricing for studios and instructors worldwide.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}