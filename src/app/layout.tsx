import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CalaStudio',
  description: 'Your sessions. Your rules. Your members.',
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