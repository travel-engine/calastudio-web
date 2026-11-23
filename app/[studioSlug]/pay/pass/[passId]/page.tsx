import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import styles from '../../../photofirst.module.css'
import PayPassClient from './PayPassClient'

// Pay for a pass the studio added as unpaid: the "payment reminder" email links here
// ({slug}.calastudio.app/pay/pass/{passId}?t={token}). No sign-in: the signed token only lets
// someone pay for this one pass (the user's choice; migrated members often haven't set a password).
// The API decides everything: whether it's still unpaid, the amount, and records the payment.

export const metadata: Metadata = {
  title: 'Pay for your pass',
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ studioSlug: string; passId: string }>
  searchParams: Promise<{ t?: string }>
}

export default async function PayPassPage({ params, searchParams }: Props) {
  const { studioSlug, passId } = await params
  const { t } = await searchParams
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}`, { next: { revalidate: 60 } })
  if (res.status === 404) notFound()
  if (!res.ok) throw new Error('Failed to load studio')
  const org: { id: string; name: string; stripe_account_id: string | null } = await res.json()

  return (
    <div className={styles.root}>
      <main className={styles.container} style={{ display: 'flex', justifyContent: 'center', paddingTop: 32, paddingBottom: 48 }}>
        <PayPassClient studioSlug={studioSlug} studioName={org.name} passId={passId}
          token={t ?? ''} stripeAccountId={org.stripe_account_id} />
      </main>
    </div>
  )
}
