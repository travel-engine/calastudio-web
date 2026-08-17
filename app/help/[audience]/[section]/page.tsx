import { getSections, sectionNames } from '@/lib/help'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ audience: string; section: string }>
}

export default async function SectionPage({ params }: Props) {
  const { audience, section } = await params

  if (audience !== 'studio' && audience !== 'member') notFound()

  const sections = getSections(audience)
  const articles = sections[section]
  if (!articles) notFound()

  const audienceColor = audience === 'studio' ? '#085041' : '#1B4F8A'

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f4f4' }}>
      <div style={{ backgroundColor: audienceColor, padding: '32px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <Link href="/help" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '14px' }}>Help Centre</Link>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>→</span>
            <span style={{ color: 'white', fontSize: '14px' }}>{sectionNames[section] ?? section}</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'white' }}>
            {sectionNames[section] ?? section}
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {articles.map((article, i) => (
            <Link
              key={article.slug}
              href={`/help/${audience}/${section}/${article.slug}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: i < articles.length - 1 ? '1px solid #f4f4f4' : 'none', textDecoration: 'none' }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px', color: '#1a1a1a', marginBottom: '4px' }}>
                  {article.title}
                </div>
                {article.description && (
                  <div style={{ fontSize: '13px', color: '#666' }}>{article.description}</div>
                )}
              </div>
              <span style={{ color: audienceColor, fontSize: '18px', marginLeft: '16px' }}>→</span>
            </Link>
          ))}
        </div>
        <div style={{ marginTop: '24px' }}>
          <Link href="/help" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>
            ← Back to Help Centre
          </Link>
        </div>
      </div>
    </div>
  )
}