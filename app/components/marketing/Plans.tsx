import Link from 'next/link'
import styles from '@/app/home.module.css'
import { PRICING, aud, annualSaving, paygExample } from './pricing'

function Plan({ name, price, per, points, cta, tag }: {
  name: string; price: string; per: string; points: string[]; cta: string; tag?: string
}) {
  return (
    <div className={styles.plan}>
      <div className={styles.planTop}>
        <h3>{name}</h3>
        {tag && <span className={styles.planTag}>{tag}</span>}
      </div>
      <p className={styles.planPrice}>{price}</p>
      <p className={styles.planPer}>{per}</p>
      <ul className={styles.planPoints}>
        {points.map(pt => <li key={pt}>{pt}</li>)}
      </ul>
      <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/register">{cta}</Link>
    </div>
  )
}

// What CalaStudio charges the teacher or studio (not what members pay them).
export default function Plans() {
  const ex = paygExample()
  const saving = annualSaving()
  return (
    <section className={styles.bandWhite} id="pricing">
      <div className={`${styles.plans} ${styles.wrap}`}>
        <div className={styles.plansIntro}>
          <p className={styles.eyebrow}>Pricing</p>
          <h2 className={styles.h2}>Start with nothing up front. Switch to a flat fee when it suits you.</h2>
        </div>
        <div className={styles.planGrid}>
          <Plan
            name="Pay as you go"
            price={`${PRICING.percentage}%`}
            per="of each booking, after Stripe fees, + GST"
            points={['No monthly fee', 'No card needed to start', 'You only pay when members book']}
            cta="Start free"
          />
          <Plan
            name="Monthly"
            price={aud(PRICING.monthly)}
            per="a month, incl. GST"
            points={['One flat fee, however busy you are', 'No CalaStudio fee on bookings', 'Change plans any time']}
            cta="Get started"
          />
          <Plan
            name="Annual"
            price={aud(PRICING.annual)}
            per="a year, incl. GST"
            points={['Best value if you teach all year', 'No CalaStudio fee on bookings', 'One payment a year']}
            cta="Get started"
            tag={saving > 0 ? `Save ${aud(saving)}` : undefined}
          />
        </div>
        <div className={styles.planNotes}>
          <p>
            <strong>How Pay as you go works:</strong>{' '}a member buys a $20 class pass. Stripe&apos;s card fee is
            about {aud(ex.stripeFee)}, leaving {aud(ex.net)}. CalaStudio&apos;s fee is {PRICING.percentage}% of that,
            {' '}{aud(ex.fee)}, plus {aud(ex.gst)} GST.
          </p>
          <p>
            Prices are in Australian dollars. Australian businesses get a tax invoice showing GST; teachers and
            studios outside Australia aren&apos;t charged GST. Stripe&apos;s card fees apply on every plan.
          </p>
        </div>
      </div>
    </section>
  )
}
