import type { Metadata } from 'next'
import { Bricolage_Grotesque, Manrope } from 'next/font/google'
import styles from './home.module.css'
import { SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/lib/jsonLd'
import SiteHeader from '@/app/components/marketing/SiteHeader'
import Hero from '@/app/components/marketing/Hero'
import Features from '@/app/components/marketing/Features'
import PricingTransparency from '@/app/components/marketing/PricingTransparency'
import Plans from '@/app/components/marketing/Plans'
import FounderQuote from '@/app/components/marketing/FounderQuote'
import Faq, { FAQ } from '@/app/components/marketing/Faq'
import ClosingCta from '@/app/components/marketing/ClosingCta'
import SiteFooter from '@/app/components/marketing/SiteFooter'
import { PRICING } from '@/app/components/marketing/pricing'

// Public homepage, built from handoff/index.html. Fonts are scoped to this page so the dashboard
// and studio sites keep theirs.
const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700'], display: 'swap', variable: '--font-home-display' })
const body = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-home-body' })

const title = 'CalaStudio — booking software for teachers who teach in more than one place'
const description =
  'Take bookings, sell passes and memberships, and keep your students in one place, wherever you teach. Start free on Pay as you go, or pay a flat monthly fee.'

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: '/' },
  // A child that sets openGraph replaces the layout's whole object, so repeat the shared fields.
  openGraph: { type: 'website', siteName: 'CalaStudio', title, description, url: '/' },
  twitter: { card: 'summary_large_image', title, description },
}

const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'CalaStudio',
  url: SITE_URL,
  description: 'Booking software for yoga and fitness teachers and studios.',
  sameAs: [] as string[],
}

const productLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'CalaStudio',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: SITE_URL,
  description,
  offers: [
    { '@type': 'Offer', name: 'Pay as you go', priceCurrency: PRICING.currency, price: '0', description: `No fixed fee: ${PRICING.percentage}% of each booking after Stripe fees, plus GST.` },
    { '@type': 'Offer', name: 'Monthly', priceCurrency: PRICING.currency, price: String(PRICING.monthly), description: 'Flat fee each month, including GST.' },
    { '@type': 'Offer', name: 'Annual', priceCurrency: PRICING.currency, price: String(PRICING.annual), description: 'Flat fee each year, including GST.' },
  ],
}

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
}

export default function Home() {
  return (
    <div className={`${display.variable} ${body.variable} ${styles.page}`}>
      <JsonLd data={[orgLd, productLd, faqLd]} />
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <PricingTransparency />
        <Plans />
        <FounderQuote />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  )
}
