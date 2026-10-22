import Link from 'next/link'
import styles from '@/app/home.module.css'

export function Logo({ size = 32, rays = '#15241F' }: { size?: number; rays?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="7" fill="#E8A33D" />
      <path d="M16 2v4M16 26v4M2 16h4M26 16h4M6.1 6.1l2.8 2.8M23.1 23.1l2.8 2.8M6.1 25.9l2.8-2.8M23.1 8.9l2.8-2.8" stroke={rays} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function SiteHeader() {
  return (
    <header className={`${styles.header} ${styles.wrap}`}>
      <Link className={styles.logo} href="/" aria-label="CalaStudio home">
        <Logo />
        <span>CalaStudio</span>
      </Link>
      <nav className={styles.nav} aria-label="Main">
        <a className={`${styles.navLink} ${styles.navOptional}`} href="#how">How it works</a>
        <a className={styles.navLink} href="#pricing">Pricing</a>
        <a className={`${styles.navLink} ${styles.navOptional}`} href="#faq">FAQ</a>
        <Link className={styles.navLink} href="/login">Sign in</Link>
        <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/register">Start free</Link>
      </nav>
    </header>
  )
}
