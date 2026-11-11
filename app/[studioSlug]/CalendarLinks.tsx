import styles from './photofirst.module.css'

// "Add to calendar" for a member's booking. Both links come from the API (signed, so they work
// without signing in): the .ics opens Apple Calendar / Outlook on a phone; Google gets its own link
// because the Gmail / Google Calendar apps don't take .ics files well. Renders nothing when the API
// sends no links (past, cancelled, or not yet confirmed).
export default function CalendarLinks({ icsUrl, googleUrl, compact = false }: {
  icsUrl?: string | null
  googleUrl?: string | null
  compact?: boolean
}) {
  if (!icsUrl && !googleUrl) return null
  const ics = icsUrl?.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL}${icsUrl}` : icsUrl

  const links = (
    <>
      {ics && <a href={ics} className={styles.calBtn}>Apple / Outlook</a>}
      {googleUrl && <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={styles.calBtn}>Google Calendar</a>}
    </>
  )

  if (compact) {
    return (
      <details className={styles.calMenu}>
        <summary className={styles.calSummary}>Add to calendar</summary>
        <div className={styles.calRow}>{links}</div>
      </details>
    )
  }
  return (
    <div className={styles.calWrap}>
      <p className={styles.calLabel}>Add to your calendar</p>
      <div className={styles.calRow}>{links}</div>
    </div>
  )
}
