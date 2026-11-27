import Link from 'next/link'
import { DEMO_URL } from '@/lib/demoUrl'
import styles from '@/app/home.module.css'

export default function ClosingCta() {
  return (
    <section className={`${styles.closing} ${styles.wrap}`}>
      <div className={styles.closingCard}>
        <h2>Take your first booking tonight.</h2>
        <p>Free to start. We&apos;ll help you move your students across.</p>
        <Link className={`${styles.btn} ${styles.btnDark}`} href="/register">Start free</Link>
        <p style={{ marginTop: 14 }}>Rather look around first? <a href={DEMO_URL} style={{ fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>Try the demo studio</a></p>
      </div>
    </section>
  )
}
