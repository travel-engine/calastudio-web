import styles from '@/app/home.module.css'

// What a member sees: the price with the reason for any discount next to it. Example figures.
export default function PricingTransparency() {
  return (
    <section className={`${styles.transparency} ${styles.wrap}`}>
      <div className={styles.transparencyCopy}>
        <p className={styles.eyebrow}>Nothing hidden</p>
        <h2 className={styles.h2}>Every member can see why they pay what they pay.</h2>
        <p>Loyalty discounts, concession rates and early-bird prices are shown to members with the reason next to them. Trust builds itself.</p>
      </div>
      <div className={styles.priceCardWrap}>
        <div className={styles.priceCard}>
          <span className={styles.display} style={{ fontSize: 20 }}>Your pricing</span>
          <div className={styles.priceRule}>
            <div><strong>Loyal member discount</strong><small>You&apos;ve been coming for over a year</small></div>
            <strong style={{ color: 'var(--brand)' }}>−15%</strong>
          </div>
          <div className={styles.priceTotal}>
            <span style={{ color: 'var(--ink-2)' }}>Your drop-in price</span>
            <span><span className={styles.was}><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>Was </span>$25.00</span><span className={styles.now}>$21.25</span></span>
          </div>
        </div>
      </div>
    </section>
  )
}
