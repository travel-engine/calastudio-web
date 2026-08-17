import { getSections, sectionNames } from '@/lib/help'
import Link from 'next/link'

export const metadata = {
  title: 'Help Centre — CalaStudio',
  description: 'Guides and answers for CalaStudio studios and members',
}

export default function HelpPage() {
  const studioSections = getSections('studio')
  const memberSections = getSections('member')

  const sectionIcons: Record<string, string> = {
    'getting-started': '🚀',
    'sessions': '📅',
    'members': '👥',
    'pricing': '💰',
    'payments': '💳',
    'team': '👤',
    'booking': '🎟',
    'passes': '🎫',
    'account': '⚙️',
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f4f4' }}>

      {/* Header */}
      <div style={{ backgroundColor: '#085041', padding: '48px 24px', textAlign: 'center' }}>
        <Link href="/" style={{ display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 700, fontSize: '16px', padding: '6px 16px', borderRadius: '8px', marginBottom: '24px', textDecoration: 'none' }}>
          CalaStudio
        </Link>
        <h1 style={{ fontSize: '36px', fontWeight: 700, color: 'white', marginBottom: '12px' }}>
          Help Centre
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', marginBottom: '32px' }}>
          Guides and answers for studios and members
        </p>

        {/* Search */}
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <Link
            href="/help/search"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 20px',
              backgroundColor: 'white',
              borderRadius: '10px',
              color: '#999',
              textDecoration: 'none',
              fontSize: '15px'
            }}
          >
            🔍 Search the help centre...
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px' }}>

        {/* Studio help */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#085041', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
              🏢
            </div>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a1a' }}>For studio owners</h2>
              <p style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>Managing your studio, sessions, members, and payments</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {Object.entries(studioSections).map(([section, articles]) => (
              <Link
                key={section}
                href={`/help/studio/${section}`}
                style={{
                  display: 'block',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  textDecoration: 'none',
                  border: '1px solid #e2e2e2',
                  transition: 'border-color 0.15s'
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>
                  {sectionIcons[section] ?? '📄'}
                </div>
                <div style={{ fontWeight: 600, fontSize: '15px', color: '#1a1a1a', marginBottom: '6px' }}>
                  {sectionNames[section] ?? section}
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {articles.length} article{articles.length !== 1 ? 's' : ''}
                </div>
                <div style={{ marginTop: '12px' }}>
                  {articles.slice(0, 3).map(a => (
                    <div key={a.slug} style={{ fontSize: '12px', color: '#085041', marginBottom: '4px' }}>
                      → {a.title}
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Member help */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#1B4F8A', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
              👤
            </div>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a1a' }}>For members</h2>
              <p style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>Booking sessions, managing passes, and your account</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {Object.entries(memberSections).map(([section, articles]) => (
              <Link
                key={section}
                href={`/help/member/${section}`}
                style={{
                  display: 'block',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  textDecoration: 'none',
                  border: '1px solid #e2e2e2'
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>
                  {sectionIcons[section] ?? '📄'}
                </div>
                <div style={{ fontWeight: 600, fontSize: '15px', color: '#1a1a1a', marginBottom: '6px' }}>
                  {sectionNames[section] ?? section}
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {articles.length} article{articles.length !== 1 ? 's' : ''}
                </div>
                <div style={{ marginTop: '12px' }}>
                  {articles.slice(0, 3).map(a => (
                    <div key={a.slug} style={{ fontSize: '12px', color: '#1B4F8A', marginBottom: '4px' }}>
                      → {a.title}
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '64px', paddingTop: '32px', borderTop: '1px solid #e2e2e2' }}>
          <p style={{ color: '#666', fontSize: '14px' }}>
            Can&apos;t find what you&apos;re looking for?{' '}
            <Link href="mailto:help@calastudio.app" style={{ color: '#085041' }}>
              Contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}