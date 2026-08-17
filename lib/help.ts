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

export function searchArticles(query: string, audience: 'studio' | 'member'): ArticleMeta[] {
  if (!query.trim()) return []
  const articles = getAllArticles(audience)
  const q = query.toLowerCase()
  return articles.filter(a =>
    a.title.toLowerCase().includes(q) ||
    a.description.toLowerCase().includes(q) ||
    a.section.toLowerCase().includes(q)
  )
}

export const sectionNames: Record<string, string> = {
  'getting-started': 'Getting started',
  'sessions': 'Sessions',
  'members': 'Members',
  'pricing': 'Pricing',
  'payments': 'Payments',
  'team': 'Team',
  'booking': 'Booking sessions',
  'passes': 'Passes',
  'account': 'My account',
}