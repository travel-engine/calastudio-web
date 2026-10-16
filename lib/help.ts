import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkHtml from 'remark-html'
import remarkGfm from 'remark-gfm'

const helpDir = path.join(process.cwd(), 'content/help')

export interface ArticleMeta {
  slug: string
  section: string
  audience: 'studio' | 'member'
  title: string
  description: string
  order: number
}

export interface Article extends ArticleMeta {
  content: string
}

export function getAllArticles(audience: 'studio' | 'member'): ArticleMeta[] {
  const audienceDir = path.join(helpDir, audience)
  const articles: ArticleMeta[] = []

  if (!fs.existsSync(audienceDir)) return []

  const sections = fs.readdirSync(audienceDir)

  for (const section of sections) {
    const sectionDir = path.join(audienceDir, section)
    if (!fs.statSync(sectionDir).isDirectory()) continue

    const files = fs.readdirSync(sectionDir).filter(f => f.endsWith('.md'))

    for (const file of files) {
      const filePath = path.join(sectionDir, file)
      const fileContents = fs.readFileSync(filePath, 'utf8')
      const { data } = matter(fileContents)
      const slug = file.replace('.md', '')

      articles.push({
        slug,
        section,
        audience,
        title: data.title ?? slug,
        description: data.description ?? '',
        order: data.order ?? 99,
      })
    }
  }

  return articles.sort((a, b) => a.order - b.order)
}

export function getSections(audience: 'studio' | 'member') {
  const articles = getAllArticles(audience)
  const sections: Record<string, ArticleMeta[]> = {}

  for (const article of articles) {
    if (!sections[article.section]) sections[article.section] = []
    sections[article.section].push(article)
  }

  for (const section of Object.keys(sections)) {
    sections[section].sort((a, b) => a.order - b.order)
  }

  return sections
}

export async function getArticle(
  audience: 'studio' | 'member',
  section: string,
  slug: string
): Promise<Article | null> {
  const filePath = path.join(helpDir, audience, section, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null

  const fileContents = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(fileContents)

  const processedContent = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(content)

  return {
    slug,
    section,
    audience,
    title: data.title ?? slug,
    description: data.description ?? '',
    order: data.order ?? 99,
    content: processedContent.toString(),
  }
}

export interface SearchHit extends ArticleMeta {
  score: number
  snippet: string
}

// Full-text search across the given audiences (default both) — title/description/body. Small
// corpus (~30 short articles), so a plain in-memory scan per request is fine.
export function searchAllArticles(
  query: string,
  audiences: ('studio' | 'member')[] = ['studio', 'member'],
): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const terms = q.split(/\s+/).filter(Boolean)

  const hits: SearchHit[] = []

  for (const audience of audiences) {
    const audienceDir = path.join(helpDir, audience)
    if (!fs.existsSync(audienceDir)) continue

    for (const section of fs.readdirSync(audienceDir)) {
      const sectionDir = path.join(audienceDir, section)
      if (!fs.statSync(sectionDir).isDirectory()) continue

      for (const file of fs.readdirSync(sectionDir).filter(f => f.endsWith('.md'))) {
        const raw = fs.readFileSync(path.join(sectionDir, file), 'utf8')
        const { data, content } = matter(raw)
        const slug = file.replace('.md', '')
        const title: string = data.title ?? slug
        const description: string = data.description ?? ''
        const bodyText = content.replace(/[#>*`_[\]()|-]/g, ' ').replace(/\s+/g, ' ').trim()

        const hayTitle = title.toLowerCase()
        const hayDesc = description.toLowerCase()
        const hayBody = bodyText.toLowerCase()

        // Every term has to appear somewhere.
        if (!terms.every(t => hayTitle.includes(t) || hayDesc.includes(t) || hayBody.includes(t) || section.includes(t))) {
          continue
        }

        let score = 0
        for (const t of terms) {
          if (hayTitle.includes(t)) score += 10
          if (hayDesc.includes(t)) score += 4
          if (section.includes(t)) score += 3
          if (hayBody.includes(t)) score += 1
        }

        let snippet = description || `${bodyText.slice(0, 160)}…`
        const idx = hayBody.indexOf(terms[0])
        if (idx >= 0) {
          const start = Math.max(0, idx - 60)
          snippet = `${start > 0 ? '…' : ''}${bodyText.slice(start, start + 200).trim()}…`
        }

        hits.push({ slug, section, audience, title, description, order: data.order ?? 99, score, snippet })
      }
    }
  }

  return hits.sort((a, b) => b.score - a.score || a.order - b.order)
}

export const sectionNames: Record<string, string> = {
  'getting-started': 'Getting started',
  'sessions': 'Sessions',
  'members': 'Members',
  'pricing': 'Pricing',
  'payments': 'Payments',
  'team': 'Team',
  'settings': 'Settings',
  'reports': 'Reports',
  'booking': 'Booking sessions',
  'passes': 'Passes',
  'account': 'My account',
}