import type { Metadata } from 'next'

// Signed-in member area — keep it out of search indexes (robots.txt also disallows it).
export const metadata: Metadata = {
  title: 'My account',
  robots: { index: false, follow: false },
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children
}
