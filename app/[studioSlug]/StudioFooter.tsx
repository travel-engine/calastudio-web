import styles from './photofirst.module.css'

// Public-site footer. `poweredBy` (themed layout) swaps the account line for a "Powered by
// CalaStudio" credit, matching the design handoff's Studio Themes template.
export default function StudioFooter({
  name, email, poweredBy = false,
}: {
  name: string
  email: string | null
  poweredBy?: boolean
}) {
  return (
    <footer className={styles.footer}>
      <span>{name}</span>
      {email && <a href={`mailto:${email}`}>{email}</a>}
      {poweredBy ? (
        <span style={{ opacity: 0.7 }}>Powered by CalaStudio</span>
      ) : (
        <span>Bookings and passes in your account</span>
      )}
    </footer>
  )
}
