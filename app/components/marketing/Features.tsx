import styles from '@/app/home.module.css'

const icon = { width: 40, height: 40, viewBox: '0 0 24 24', fill: 'none', stroke: '#0F5C4F', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

export default function Features() {
  return (
    <section className={styles.bandWhite} id="how">
      <div className={`${styles.features} ${styles.wrap}`}>
        <h2 className={styles.h2}>Built for the way independent teachers actually work.</h2>
        <div className={styles.featureGrid}>
          <div className={styles.feature}>
            <svg {...icon}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.2c3 .2 5.5 2.4 5.5 5.8" /></svg>
            <h3>Your students, your list</h3>
            <p>Members book with you, not the venue. If you change venues, your community comes with you.</p>
          </div>
          <div className={styles.feature}>
            <svg {...icon}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
            <h3>Fair, clear pricing</h3>
            <p>Members see exactly what they pay and why. Their payments go straight to your own Stripe account; CalaStudio never holds your money.</p>
          </div>
          <div className={styles.feature}>
            <svg {...icon}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            <h3>Up and running tonight</h3>
            <p>Set up in under 30 minutes. Switching from another system? We&apos;ll move your students across for free.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
