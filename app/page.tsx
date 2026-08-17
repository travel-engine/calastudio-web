import Link from 'next/link'

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--brand)',
      color: 'white',
      textAlign: 'center',
      padding: 24
    }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, marginBottom: 8 }}>
        CalaStudio
      </h1>
      <p style={{ fontSize: 18, opacity: 0.8, marginBottom: 48 }}>
        Your sessions. Your rules. Your members.
      </p>
      <div style={{ display: 'flex', gap: 16 }}>
        <Link href="/register" style={{
          background: 'white',
          color: 'var(--brand)',
          padding: '12px 32px',
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 16
        }}>
          Start free
        </Link>
        <Link href="/login" style={{
          border: '2px solid white',
          color: 'white',
          padding: '12px 32px',
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 16
        }}>
          Sign in
        </Link>
      </div>
    </div>
  )
}