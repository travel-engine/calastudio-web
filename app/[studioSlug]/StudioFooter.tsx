import { HugeiconsIcon } from '@hugeicons/react'
import { InstagramIcon, Facebook01Icon, TiktokIcon, YoutubeIcon } from '@hugeicons/core-free-icons'
import styles from './photofirst.module.css'

export interface StudioSocials {
  instagram?: string | null
  facebook?: string | null
  tiktok?: string | null
  youtube?: string | null
}

// Public-site footer. `poweredBy` (themed layout) swaps the account line for a "Powered by
// CalaStudio" credit, matching the design handoff's Studio Themes template. Social icons use
// `currentColor` (the icon set's default stroke), so they pick up whichever token colours the
// surrounding link across all six themes without any per-theme styling here.
export default function StudioFooter({
  name, email, poweredBy = false, socials,
}: {
  name: string
  email: string | null
  poweredBy?: boolean
  socials?: StudioSocials
}) {
  const socialLinks = [
    socials?.instagram ? { label: 'Instagram', href: socials.instagram, icon: InstagramIcon } : null,
    socials?.facebook ? { label: 'Facebook', href: socials.facebook, icon: Facebook01Icon } : null,
    socials?.tiktok ? { label: 'TikTok', href: socials.tiktok, icon: TiktokIcon } : null,
    socials?.youtube ? { label: 'YouTube', href: socials.youtube, icon: YoutubeIcon } : null,
  ].filter((l): l is { label: string; href: string; icon: typeof InstagramIcon } => l !== null)

  return (
    <footer className={styles.footer}>
      <span>{name}</span>
      {email && <a href={`mailto:${email}`}>{email}</a>}
      {socialLinks.length > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '14px' }}>
          {socialLinks.map(l => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={l.label}
              title={l.label}
              style={{ display: 'inline-flex' }}
            >
              <HugeiconsIcon icon={l.icon} size={18} strokeWidth={1.5} />
            </a>
          ))}
        </span>
      )}
      {poweredBy ? (
        <span style={{ opacity: 0.7 }}>Powered by CalaStudio</span>
      ) : (
        <span>Bookings and passes in your account</span>
      )}
    </footer>
  )
}
