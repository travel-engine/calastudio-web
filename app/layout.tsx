import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/seo'
import MojibakeCanary from '@/app/components/MojibakeCanary'
import './globals.css'

const description =
  'The booking platform for yoga and fitness studios that never takes a cut. Flat monthly fee, zero commission, and every price and change fully explainable.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'CalaStudio — Your sessions. Your rules. Your members.',
    template: '%s · CalaStudio',
  },
  description,
  applicationName: 'CalaStudio',
  keywords: [
    'studio booking software',
    'yoga studio management',
    'fitness class booking',
    'zero commission booking platform',
    'class pass and membership software',
    'pilates studio scheduling',
  ],
  openGraph: {
    type: 'website',
    siteName: 'CalaStudio',
    title: 'CalaStudio — Your sessions. Your rules. Your members.',
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CalaStudio — Your sessions. Your rules. Your members.',
    description,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {process.env.NODE_ENV !== 'production' && <MojibakeCanary />}
        {children}
      </body>
    </html>
  )
}
