import Link from 'next/link'
import styles from '@/app/home.module.css'

// Terms and Privacy join the footer nav once those pages exist.
export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.footerInner} ${styles.wrap}`}>
        <span>© {new Date().getFullYear()} CalaStudio · calastudio.app</span>
        <nav className={styles.footerNav} aria-label="Footer">
          <Link href="/help">Help</Link>
        </nav>
      </div>
    </footer>
  )
}
