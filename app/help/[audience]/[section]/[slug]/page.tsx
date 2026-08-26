import { getArticle, getSections, sectionNames } from '@/lib/help'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RequireAuth from '../../../RequireAuth'

interface Props {
  params: Promise<{ audience: string; section: string; slug: string }>
}

export default async function ArticlePage({ params }: Props) {
  const { audience, section, slug } = await params

  if (audience !== 'studio' && audience !== 'member') notFound()

  const article = await getArticle(audience, section, slug)
  if (!article) notFound()

  const sections = getSections(audience)
  const sectionArticles = sections[section] ?? []
  const audienceColor = audience === 'studio' ? '#085041' : '#1B4F8A'

  const content = (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f4f4' }}>

      {/* Header */}
      <div style={{ backgroundColor: audienceColor, padding: '32px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <Link href="/help" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '13px' }}>Help Centre</Link>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>→</span>
            <Link href={`/help/${audience}/${section}`} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '13px' }}>
              {sectionNames[section] ?? section}
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>→</span>
            <span style={{ color: 'white', fontSize: '13px' }}>{article.title}</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'white' }}>{article.title}</h1>
          {article.description && (
            <p style={{ color: 'rgba(255,255,255,0.8)', marginTop: '8px', fontSize: '15px' }}>
              {article.description}
            </p>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: '32px', alignItems: 'start' }}>

        {/* Article */}
        <div>
          <div
            className="article-content"
            style={{ backgroundColor: 'white', borderRadius: '12px', padding: '40px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', lineHeight: 1.8 }}
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {/* Feedback */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>Was this article helpful?</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button style={{ padding: '8px 24px', border: '1px solid #e2e2e2', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' }}>👍 Yes</button>
              <button style={{ padding: '8px 24px', border: '1px solid #e2e2e2', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' }}>👎 No</button>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <Link href={`/help/${audience}/${section}`} style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>
              ← Back to {sectionNames[section] ?? section}
            </Link>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ position: 'sticky', top: '32px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              In this section
            </h3>
            {sectionArticles.map(a => (
              <Link
                key={a.slug}
                href={`/help/${audience}/${section}/${a.slug}`}
                style={{ display: 'block', padding: '8px 12px', borderRadius: '6px', fontSize: '14px', textDecoration: 'none', marginBottom: '2px', backgroundColor: a.slug === slug ? '#e8f5ee' : 'transparent', color: a.slug === slug ? audienceColor : '#444', fontWeight: a.slug === slug ? 600 : 400 }}
              >
                {a.title}
              </Link>
            ))}
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              Need more help?
            </h3>
            <Link href="mailto:help@calastudio.app" style={{ fontSize: '14px', color: audienceColor }}>
              Contact support →
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        .article-content h1 { font-size: 26px; font-weight: 700; margin: 0 0 24px; color: #1a1a1a; }
        .article-content h2 { font-size: 20px; font-weight: 600; margin: 32px 0 12px; color: #1a1a1a; border-bottom: 1px solid #f4f4f4; padding-bottom: 8px; }
        .article-content h3 { font-size: 16px; font-weight: 600; margin: 24px 0 8px; color: #1a1a1a; }
        .article-content p { margin: 0 0 16px; color: #333; font-size: 15px; }
        .article-content ul, .article-content ol { margin: 0 0 16px; padding-left: 24px; }
        .article-content li { margin-bottom: 8px; color: #333; font-size: 15px; }
        .article-content table { width: 100%; border-collapse: collapse; margin: 0 0 20px; }
        .article-content th { background: #f4f4f4; padding: 10px 14px; text-align: left; font-size: 13px; font-weight: 600; color: #666; }
        .article-content td { padding: 10px 14px; border-bottom: 1px solid #f4f4f4; font-size: 14px; color: #333; }
        .article-content blockquote { border-left: 3px solid #085041; margin: 0 0 16px; padding: 12px 16px; background: #e8f5ee; border-radius: 0 8px 8px 0; color: #085041; font-size: 14px; }
        .article-content code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: monospace; }
        .article-content a { color: #085041; }
        .article-content strong { font-weight: 600; color: #1a1a1a; }
        .article-content hr { border: none; border-top: 1px solid #e2e2e2; margin: 24px 0; }
      `}</style>
    </div>
  )

  return audience === 'studio' ? <RequireAuth>{content}</RequireAuth> : content
}