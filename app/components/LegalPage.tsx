import Link from 'next/link'
import type { ReactNode } from 'react'

// Shared shell for the platform's legal documents (/terms, /privacy): plain, readable on a phone,
// printable. Server component; no client JS.

export function LegalPage({ title, version, effective, children }: {
  title: string; version?: string; effective: string; children: ReactNode
}) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f4f4' }}>
      <header style={{ backgroundColor: '#085041', padding: '40px 16px 36px', textAlign: 'center' }}>
        <Link href="/" style={{ display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 700, fontSize: '16px', padding: '6px 16px', borderRadius: '8px', marginBottom: '20px', textDecoration: 'none' }}>
          CalaStudio
        </Link>
        <h1 style={{ fontSize: '32px', lineHeight: 1.15, fontWeight: 700, color: 'white', margin: '0 0 10px' }}>{title}</h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px', margin: 0 }}>
          {version ? `Version ${version} · ` : ''}Effective {effective}
        </p>
      </header>
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px 64px' }}>
        <article style={{ backgroundColor: 'white', borderRadius: 12, padding: 'clamp(20px, 5vw, 40px)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', fontSize: 16, lineHeight: 1.65, color: '#1a1a1a' }}>
          {children}
        </article>
        <nav style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 24, fontSize: 14 }}>
          <Link href="/terms" style={{ color: '#085041', fontWeight: 600 }}>Terms &amp; Conditions</Link>
          <Link href="/privacy" style={{ color: '#085041', fontWeight: 600 }}>Privacy Policy</Link>
          <Link href="/help" style={{ color: '#085041', fontWeight: 600 }}>Help Centre</Link>
        </nav>
      </main>
    </div>
  )
}

export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return <h2 id={id} style={{ fontSize: 20, fontWeight: 700, margin: '32px 0 8px', scrollMarginTop: 16 }}>{children}</h2>
}

export function P({ children }: { children: ReactNode }) {
  return <p style={{ margin: '0 0 12px' }}>{children}</p>
}

export function UL({ children }: { children: ReactNode }) {
  return <ul style={{ margin: '0 0 12px', paddingLeft: 22 }}>{children}</ul>
}
