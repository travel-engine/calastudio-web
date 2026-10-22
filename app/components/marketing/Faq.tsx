import styles from '@/app/home.module.css'
import { PRICING, aud } from './pricing'

export const FAQ = [
  {
    q: "I teach inside a gym's own schedule. Does that still work?",
    a: 'Yes. Use CalaStudio for the classes you run yourself. Classes the venue runs and sells stay on its own system; you decide what each arrangement allows.',
  },
  {
    q: 'Can one pass work at every place I teach?',
    a: 'Yes. Passes and memberships belong to you, so students can use them at any of your classes, or only the ones you choose.',
  },
  {
    q: 'What does it cost?',
    a: `Start on Pay as you go: no monthly fee, just ${PRICING.percentage}% of each booking after Stripe's fees, plus GST. Or pay a flat ${aud(PRICING.monthly)} a month or ${aud(PRICING.annual)} a year, including GST, with no CalaStudio fee on bookings. Stripe's card fees apply on every plan.`,
  },
]

export default function Faq() {
  return (
    <section className={styles.faq} id="faq">
      <h2 className={styles.h2}>Questions teachers ask</h2>
      <div>
        {FAQ.map(f => (
          <div key={f.q} className={styles.faqItem}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
