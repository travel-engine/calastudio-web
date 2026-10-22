import styles from '@/app/home.module.css'
import { Logo } from './SiteHeader'

export default function FounderQuote() {
  return (
    <section className={styles.founder}>
      <figure className={styles.founderInner} style={{ margin: 0 }}>
        <Logo size={44} rays="#E8A33D" />
        <blockquote>“I built CalaStudio because I teach yoga at a gym and a studio, and no software was made for teachers like me.”</blockquote>
        <figcaption className={styles.founderWho}>
          {/* Initial until a founder photo is supplied. */}
          <div className={styles.photo} aria-hidden="true">R</div>
          <div><strong>Ravi</strong><small>Founder, yoga teacher since 2015</small></div>
        </figcaption>
      </figure>
    </section>
  )
}
