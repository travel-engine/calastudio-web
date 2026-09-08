import Link from 'next/link'
import { searchAllArticles, sectionNames } from '@/lib/help'

interface Props {
  searchParams: Promise<{ q?: string }>
}

export const metadata = {
  title: 'Search — Help Centre',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '14px 18px', borderRadius: '10px', border: 'none',
  fontSize: '15px', outline: 'none',
}

export default async function HelpSearchPage({ searchParams }: Props) {
  const { q = '' } = await searchParams
  const query = q.trim()
  const results = query ? searchAllArticles(query) : []

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f4f4' }}>
      <div style={{ backgroundColor: '#085041', padding: '32px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Link href="/help" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '14px' }}>
            ← Help Centre
          </Link>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'white', margin: '12px 0 16px' }}>Search</h1>
          <form action="/help/search" method="get">
            <input name="q" type="search" defaultValue={query} placeholder="Search the help centre…" autoFocus style={inputStyle} />
          </form>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
        {!query ? (
          <p style={{ color: '#666', fontSize: '14px' }}>Type something above to search the guides.</p>
        ) : results.length === 0 ? (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
              No results for &ldquo;{query}&rdquo;. Try different words, or{' '}
              <Link href="mailto:help@calastudio.app" style={{ color: '#085041' }}>contact support</Link>.
            </p>
          </div>
        ) : (
          <>
            <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>
              {results.length} result{results.length === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
            </p>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              {results.map((r, i) => (
                <Link
                  key={`${r.audience}/${r.section}/${r.slug}`}
                  href={`/help/${r.audience}/${r.section}/${r.slug}`}
                  style={{ display: 'block', padding: '18px 24px', borderBottom: i < results.length - 1 ? '1px solid #f4f4f4' : 'none', textDecoration: 'none' }}
                >
                  <span style={{
                    display: 'inline-block', fontSize: '11px', fontWeight: 600, marginBottom: '6px',
                    color: r.audience === 'studio' ? '#085041' : '#1B4F8A',
                    backgroundColor: r.audience === 'studio' ? '#e8f5ee' : '#e8eef8',
                    borderRadius: '999px', padding: '2px 8px',
                  }}>
                    {r.audience === 'studio' ? 'Studio' : 'Member'} · {sectionNames[r.section] ?? r.section}
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '15px', color: '#1a1a1a', marginBottom: '4px' }}>{r.title}</div>
                  <div style={{ fontSize: '13px', color: '#666' }}>{r.snippet}</div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
