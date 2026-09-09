import styles from './photofirst.module.css'

// Public-site footer (handoff §Screen: Home footer). Plain identity + contact line — no nav.
export default function StudioFooter({ name, email }: { name: string; email: string | null }) {
  return (
    <footer className={styles.footer}>
      <span>{name}</span>
      {email && <a href={`mailto:${email}`}>{email}</a>}
      <span>Bookings and passes in your account</span>
    </footer>
  )
}
