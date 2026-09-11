import styles from './photofirst.module.css'

export interface StudioSocials {
  instagram?: string | null
  facebook?: string | null
  tiktok?: string | null
  youtube?: string | null
}

// Public-site footer. `poweredBy` (themed layout) swaps the account line for a "Powered by
// CalaStudio" credit, matching the design handoff's Studio Themes template. Social links are
// plain text — the handoff uses no icon set, and text stays legible across every theme's palette.
export default function StudioFooter({
  name, email, poweredBy = false, socials,
}: {
  name: string
  email: string | null
  poweredBy?: boolean
  socials?: StudioSocials
}) {
  const socialLinks = [
    socials?.instagram ? { label: 'Instagram', href: socials.instagram } : null,
    socials?.facebook ? { label: 'Facebook', href: socials.facebook } : null,
    socials?.tiktok ? { label: 'TikTok', href: socials.tiktok } : null,
    socials?.youtube ? { label: 'YouTube', href: socials.youtube } : null,
  ].filter((l): l is { label: string; href: string } => l !== null)

  return (
    <footer className={styles.footer}>
      <span>{name}</span>
      {email && <a href={`mailto:${email}`}>{email}</a>}
      {socialLinks.map(l => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
      ))}
      {poweredBy ? (
        <span style={{ opacity: 0.7 }}>Powered by CalaStudio</span>
      ) : (
        <span>Bookings and passes in your account</span>
      )}
    </footer>
  )
}
