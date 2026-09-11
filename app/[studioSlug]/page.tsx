import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import styles from './photofirst.module.css'
import type { BookableOccurrence } from '@/lib/store/bookingFlow'
import BookingDrawer from './BookingDrawer'
import MemberScheduleLoader from './MemberScheduleLoader'
import SessionRow from './SessionRow'
import Gallery from './Gallery'
import StudioFooter from './StudioFooter'
import { getStudioContent, headlineRuns, type PageContentDto } from './studioContent'
import { studioThemeForRequest } from '@/lib/resolveStudioTheme'
import { metaDescription, studioOpenGraph, studioOrigin } from '@/lib/seo'
import { JsonLd, studioLd } from '@/lib/jsonLd'

export const revalidate = 60

interface Props {
  params: Promise<{ studioSlug: string }>
}

interface PublicOrgInfo {
  id: string
  slug: string
  name: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
  brand_color: string | null
  currency: string
  stripe_account_id: string | null
  payments_enabled: boolean
  theme?: string | null
  page_content?: PageContentDto | null
}

interface PassTemplate {
  id: string
  name: string
  price: number
  currency: string
  pass_type: 'credit' | 'unlimited'
  credit_count: number | null
  expiry_type: 'fixed_date' | 'rolling_days' | 'rolling_months'
  expiry_rolling_value: number | null
}

function formatMoney(amount: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount) }
  catch { return `${currency} ${amount.toFixed(2)}` }
}

function passNote(t: PassTemplate): string {
  if (t.pass_type === 'unlimited' || t.credit_count == null) {
    if (t.expiry_type === 'rolling_months' && t.expiry_rolling_value) {
      return `Unlimited · ${t.expiry_rolling_value} month${t.expiry_rolling_value === 1 ? '' : 's'}`
    }
    return 'Unlimited classes'
  }
  if (t.expiry_type === 'rolling_days' && t.expiry_rolling_value) return `Valid ${t.expiry_rolling_value} days from purchase`
  if (t.expiry_type === 'rolling_months' && t.expiry_rolling_value) {
    return `Valid ${t.expiry_rolling_value} month${t.expiry_rolling_value === 1 ? '' : 's'} from purchase`
  }
  return `${t.credit_count} class${t.credit_count === 1 ? '' : 'es'}`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { studioSlug } = await params
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}`, { next: { revalidate: 60 } })
  if (!res.ok) return {}
  const org: PublicOrgInfo = await res.json()
  const content = getStudioContent(studioSlug, org.page_content)
  const description = metaDescription(
    content.heroLead ?? org.description,
    `Practise with ${org.name}. See the schedule and book online.`,
  )
  return {
    description,
    alternates: { canonical: '/' },
    openGraph: studioOpenGraph({
      siteName: org.name, title: org.name, description, path: '/',
      image: content.heroImageUrl || org.banner_url || org.logo_url,
    }),
  }
}

export default async function StudioHomePage({ params }: Props) {
  const { studioSlug } = await params
  const base = process.env.NEXT_PUBLIC_API_URL

  const [orgRes, occRes, passRes] = await Promise.all([
    fetch(`${base}/api/public/${studioSlug}`, { next: { revalidate: 60 } }),
    fetch(`${base}/api/public/${studioSlug}/occurrences`, { next: { revalidate: 60 } }),
    fetch(`${base}/api/public/${studioSlug}/pass-templates`, { next: { revalidate: 60 } }),
  ])
  if (orgRes.status === 404) notFound()
  if (!orgRes.ok) throw new Error('Failed to load studio')

  const org: PublicOrgInfo = await orgRes.json()
  const occurrences: BookableOccurrence[] = occRes.ok ? await occRes.json() : []
  const passTemplates: PassTemplate[] = passRes.ok ? await passRes.json() : []
  const content = getStudioContent(studioSlug, org.page_content)
  const brandColor = org.brand_color || undefined
  const theme = await studioThemeForRequest(org.theme)
  const themed = theme.layout === 'themed'

  const live = occurrences.filter(o => !o.is_cancelled)
  const featured = live.slice(0, 3)
  const passes = passTemplates.slice(0, 2)

  const canonical = `${studioOrigin(studioSlug)}/`
  const bookProps = {
    studioSlug,
    brandColor,
    stripeAccountId: org.stripe_account_id,
    paymentsEnabled: org.payments_enabled,
  }

  const headline = content.heroHeadline ?? `Practise with ${org.name}`

  return (
    <div className={`${styles.root} ${styles.rootNoFixedBar}`}>
      <JsonLd data={studioLd({ name: org.name, description: content.heroLead ?? org.description, url: canonical, image: content.heroImageUrl || org.banner_url || org.logo_url })} />

      {(() => {
        const heroCopy = (
          <>
            {content.tagline && <p className={styles.kicker}>{content.tagline}</p>}
            <h1 className={styles.heroH1}>
              {headlineRuns(headline, content.heroHeadlineEmphasis).map((r, i) =>
                r.bold ? <strong key={i}>{r.text}</strong> : <span key={i}>{r.text}</span>,
              )}
            </h1>
            {content.heroLead && <p className={styles.heroLead}>{content.heroLead}</p>}
            <div className={styles.btnRow}>
              <Link href={`/${studioSlug}/schedule`} className={styles.btnSolid}>See the schedule</Link>
              <Link href={`/${studioSlug}/teachers`} className={styles.btnGhost}>
                {content.heroCtaLabel ?? 'About the studio'}
              </Link>
            </div>
          </>
        )

        // themed: split hero (copy left, photo right). photofirst: full-bleed photo + scrim.
        return themed ? (
          <section className={styles.heroSplit}>
            <div>{heroCopy}</div>
            {content.heroImageUrl && (
              <Image
                src={content.heroImageUrl}
                alt=""
                width={520}
                height={650}
                priority
                sizes="(max-width: 900px) 100vw, 520px"
                className={styles.heroSplitImg}
              />
            )}
          </section>
        ) : (
          <section className={styles.hero}>
            {content.heroImageUrl && (
              <Image src={content.heroImageUrl} alt="" fill priority sizes="100vw" className={styles.heroImg} />
            )}
            <div className={styles.heroScrim} />
            <div />
            <div className={styles.heroBody}>{heroCopy}</div>
          </section>
        )
      })()}

      <main className={styles.container}>
        {/* Upcoming */}
        {featured.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>Upcoming</h2>
              <Link href={`/${studioSlug}/schedule`} className={styles.textBtn}>
                All Sessions
              </Link>
            </div>
            <div className={styles.rowList}>
              {featured.map(occ => (
                <SessionRow key={occ.occurrence_id} occ={occ} {...bookProps} />
              ))}
            </div>
          </section>
        )}

        {/* About */}
        {content.aboutHeading && (
          <section className={styles.split}>
            <div>
              <h2 className={styles.h2Light}>{content.aboutHeading}</h2>
              {content.aboutBody.map((p, i) => (
                <p key={i} className={styles.para}>{p}</p>
              ))}
              {content.aboutCtaLabel && (
                <Link href={`/${studioSlug}/teachers`} className={styles.btnGhost} style={{ marginTop: '10px' }}>
                  {content.aboutCtaLabel}
                </Link>
              )}
            </div>
            {content.aboutImageUrl && (
              <Image
                src={content.aboutImageUrl}
                alt=""
                width={480}
                height={480}
                sizes="(max-width: 800px) 100vw, 480px"
                className={styles.splitImg}
              />
            )}
          </section>
        )}

        {/* Gallery */}
        {content.gallery.length > 0 && (
          <section className={styles.section} style={{ paddingTop: 'clamp(16px, 3vw, 32px)' }}>
            <Gallery images={content.gallery} />
          </section>
        )}

        {/* Passes */}
        {passes.length > 0 && (
          <section className={styles.section} style={{ paddingTop: 0 }}>
            <div className={styles.passesCard}>
              <h2 className={styles.passesH2}>{content.passesHeading ?? 'Passes, or pay as you go'}</h2>
              {content.passesBlurb && <p className={styles.passesBlurb}>{content.passesBlurb}</p>}
              <div className={styles.passesGrid}>
                {passes.map(t => (
                  <div key={t.id} className={styles.passCard}>
                    <div className={styles.passLabel}>{t.name}</div>
                    <div className={styles.passPrice}>{formatMoney(t.price, t.currency || org.currency)}</div>
                    <div className={styles.passNote}>{passNote(t)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <StudioFooter name={org.name} email={content.contactEmail} poweredBy={themed} />

      <BookingDrawer />
      <MemberScheduleLoader studioSlug={studioSlug} orgId={org.id} queryString="" />
    </div>
  )
}
