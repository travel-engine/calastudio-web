import Link from 'next/link'
import styles from '@/app/home.module.css'

const CLASSES = [
  { day: 'Mon', time: '6:00', name: 'Strength & Flow', venue: 'Riverside Gym, North Lakes' },
  { day: 'Wed', time: '9:30', name: 'Slow Hatha', venue: 'The Quiet Room' },
  { day: 'Sat', time: '8:00', name: 'Community Vinyasa', venue: 'Scout Hall, Redcliffe' },
]

// Illustrative only, not live data: the whole card is one image to assistive tech and its Book
// buttons can't be focused.
function TeacherPageExample() {
  return (
    <div className={styles.teacherCard} role="img" aria-label="Example teacher booking page with classes at a gym, a studio and a community hall">
      <div className={styles.teacherHead}>
        <div className={styles.avatar}>JA</div>
        <div>
          <div className={styles.teacherName}>Jane Austen</div>
          <div className={styles.teacherSub}>Yoga · 3 places this week</div>
        </div>
      </div>
      <div className={styles.classList}>
        {CLASSES.map(c => (
          <div key={c.name} className={styles.classRow}>
            <div className={styles.when}><span className={styles.day}>{c.day}</span><span className={styles.time}>{c.time}</span></div>
            <div className={styles.what}><span className={styles.className}>{c.name}</span><span className={styles.venue}>{c.venue}</span></div>
            <button className={styles.book} type="button" tabIndex={-1}>Book</button>
          </div>
        ))}
        <div className={styles.passNote}><span>Your pass works at every venue</span><span>8 of 10 left</span></div>
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <section className={`${styles.hero} ${styles.wrap}`}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>For teachers who teach in more than one place</p>
        <h1>Your students follow you. Now your bookings do too.</h1>
        <p className={styles.lead}>
          Take bookings, sell passes and memberships, and keep your students in one place. Whether you teach at
          a gym on Monday, a studio on Wednesday or a community hall on Saturday.
        </p>
        <div className={styles.ctas}>
          <Link className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`} href="/register">Start free</Link>
          <a className={styles.linkCta} href="#example">See a teacher&apos;s page →</a>
        </div>
        <p className={styles.fine}>Set up in under 30 minutes · No monthly fee to start · No card needed</p>
      </div>
      <div className={styles.heroVisual} id="example">
        <TeacherPageExample />
      </div>
    </section>
  )
}
