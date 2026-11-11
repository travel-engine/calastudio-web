import { notFound } from 'next/navigation'
import styles from '../../../../photofirst.module.css'
import MembershipPayClient from './MembershipPayClient'

interface Props {
  params: Promise<{ studioSlug: string; id: string }>
}

// Pay an overdue membership renewal. The "payment failed" email links here
// ({slug}.calastudio.app/account/memberships/{id}/pay). Signed-in only; the account layout keeps it unindexed.
export default async function MembershipPayPage({ params }: Props) {
  const { studioSlug, id } = await params
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}`, { next: { revalidate: 60 } })
  if (res.status === 404) notFound()
  if (!res.ok) throw new Error('Failed to load studio')
  const org: { id: string; stripe_account_id: string | null } = await res.json()

  return (
    <div className={styles.root}>
      <main className={styles.container} style={{ maxWidth: '560px', paddingBottom: '48px' }}>
        <header className={styles.pageHeader}>
          <h1 className={styles.h1}>Pay for your membership</h1>
        </header>
        <MembershipPayClient studioSlug={studioSlug} orgId={org.id} membershipId={id} stripeAccountId={org.stripe_account_id} />
      </main>
    </div>
  )
}
