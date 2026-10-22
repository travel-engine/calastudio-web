import Link from 'next/link'
import styles from '@/app/home.module.css'

export default function ClosingCta() {
  return (
    <section className={`${styles.closing} ${styles.wrap}`}>
      <div className={styles.closingCard}>
        <h2>Take your first booking tonight.</h2>
        <p>Free to start. We&apos;ll help you move your students across.</p>
        <Link className={`${styles.btn} ${styles.btnDark}`} href="/register">Start free</Link>
      </div>
    </section>
  )
}
