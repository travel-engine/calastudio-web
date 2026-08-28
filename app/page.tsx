import Link from 'next/link'
import styles from './home.module.css'

function NavBar() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 10,
      backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)',
      borderBottom: '1px solid var(--border)'
    }}>
      <div style={{
        maxWidth: '1120px', margin: '0 auto', padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--brand)' }}>CalaStudio</span>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href="/login" style={{ color: 'var(--foreground)', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>
            Sign in
          </Link>
          <Link href="/register" style={{
            backgroundColor: 'var(--brand)', color: 'white', padding: '9px 18px',
            borderRadius: 'var(--radius)', fontSize: '14px', fontWeight: 600, textDecoration: 'none'
          }}>
            Start free
          </Link>
        </nav>
      </div>
    </header>
  )
}

function Section({ children, background }: { children: React.ReactNode; background?: string }) {
  return (
    <section style={{ backgroundColor: background ?? 'transparent' }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '80px 24px' }}>
        {children}
      </div>
    </section>
  )
}

function ValueCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{
      backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '16px',
      padding: '28px 24px'
    }}>
      <div style={{ fontSize: '28px', marginBottom: '16px' }}>{icon}</div>
      <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>{title}</h3>
      <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', lineHeight: 1.6 }}>{body}</p>
    </div>
  )
}

function FeatureRow({ icon, title, body, reverse }: { icon: string; title: string; body: string; reverse?: boolean }) {
  return (
    <div className={`${styles.featureRow} ${reverse ? styles.reverse : ''}`}>
      <div style={{
        flexShrink: 0, width: '96px', height: '96px', borderRadius: '20px',
        backgroundColor: 'var(--brand-light)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '40px'
      }}>
        {icon}
      </div>
      <div className={styles.featureText}>
        <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>{title}</h3>
        <p className={styles.featureBody} style={{ fontSize: '15px', color: 'var(--muted-foreground)', lineHeight: 1.7 }}>
          {body}
        </p>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <div style={{ backgroundColor: 'white' }}>
      <NavBar />

      {/* Hero */}
      <Section>
        <div style={{ textAlign: 'center', maxWidth: '760px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-block', backgroundColor: 'var(--brand-light)', color: 'var(--brand)',
            padding: '6px 14px', borderRadius: '99px', fontSize: '13px', fontWeight: 600, marginBottom: '24px'
          }}>
            You keep 100% of every booking
          </div>
          <h1 className={styles.hero} style={{ fontWeight: 800, lineHeight: 1.15, marginBottom: '20px', color: '#0a0a0a' }}>
            Your sessions. Your rules.<br />Your members.
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--muted-foreground)', lineHeight: 1.6, marginBottom: '36px' }}>
            The booking platform for yoga and fitness studios that never takes a cut. Flat monthly fee,
            zero commission, and nothing hidden — every price and every change is fully explainable.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" style={{
              backgroundColor: 'var(--brand)', color: 'white', padding: '14px 32px',
              borderRadius: 'var(--radius)', fontWeight: 600, fontSize: '16px', textDecoration: 'none'
            }}>
              Start free
            </Link>
            <Link href="/login" style={{
              border: '1px solid var(--border)', color: 'var(--foreground)', padding: '14px 32px',
              borderRadius: 'var(--radius)', fontWeight: 600, fontSize: '16px', textDecoration: 'none'
            }}>
              Sign in
            </Link>
          </div>
          <p style={{ fontSize: '13px', color: '#999', marginTop: '20px' }}>
            No credit card required · Live in under 30 minutes
          </p>
        </div>
      </Section>

      {/* Value props */}
      <Section background="var(--muted)">
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '12px' }}>
            Built for studios, not against them
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--muted-foreground)' }}>
            No marketplace games. No surprise deductions. No settings you need a manual for.
          </p>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px'
        }}>
          <ValueCard
            icon="💰"
            title="You keep 100%"
            body="One flat monthly fee. Zero commission on any booking, ever. CalaStudio is a tool that works for you — never a marketplace that takes a cut of your revenue."
          />
          <ValueCard
            icon="🔍"
            title="Nothing's a black box"
            body="Every price is explainable. Every override — a discount, a cancellation exception, a credit adjustment — is permanently logged with who changed it and why."
          />
          <ValueCard
            icon="⚡"
            title="Live in 30 minutes"
            body="Sign up, set your schedule, connect payments, and take your first real booking — no manual, no video, no support call required."
          />
          <ValueCard
            icon="🎛"
            title="Override anything"
            body="Studio-wide defaults, down to a single booking. Need to make an exception for one member on one day? Do it directly — it's logged, never hidden."
          />
        </div>
      </Section>

      {/* Feature highlights */}
      <Section>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '12px' }}>
            Everything your studio actually needs
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--muted-foreground)' }}>
            Nothing you'll never touch. Nothing missing when you need it.
          </p>
        </div>
        <div>
          <FeatureRow
            icon="📅"
            title="Sessions that fit how you teach"
            body="In-person or online. One-off or recurring, with a real calendar and roster underneath — not just a list of class names."
          />
          <FeatureRow
            icon="🎟"
            title="Passes and memberships, done right"
            body="Credit packs and unlimited plans, with flexible expiry, freezing, and auto-renewal — plus a full, immutable credit ledger so balances are never in question."
            reverse
          />
          <FeatureRow
            icon="👤"
            title="A public page for every teacher"
            body="Each teacher gets their own branded landing page with their bio, photos, and upcoming sessions — live the moment they're ready to publish it."
          />
          <FeatureRow
            icon="🕘"
            title="A complete activity log"
            body="Every create, update, and override — who, what, and when — recorded automatically and reviewable any time. Nothing is silently changed."
            reverse
          />
        </div>
      </Section>

      {/* Closing CTA */}
      <Section background="var(--brand)">
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, color: 'white', marginBottom: '12px' }}>
            Run your studio your way
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)', marginBottom: '32px' }}>
            Set up your studio and take your first booking today.
          </p>
          <Link href="/register" style={{
            display: 'inline-block', backgroundColor: 'white', color: 'var(--brand)',
            padding: '14px 36px', borderRadius: 'var(--radius)', fontWeight: 700,
            fontSize: '16px', textDecoration: 'none'
          }}>
            Start free
          </Link>
        </div>
      </Section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{
          maxWidth: '1120px', margin: '0 auto', padding: '32px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
        }}>
          <span style={{ fontWeight: 700, color: 'var(--brand)' }}>CalaStudio</span>
          <span style={{ fontSize: '13px', color: '#999' }}>
            © {new Date().getFullYear()} CalaStudio. Your sessions. Your rules. Your members.
          </span>
        </div>
      </footer>
    </div>
  )
}
