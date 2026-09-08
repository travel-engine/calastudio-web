import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'
import { getAllArticles } from '@/lib/help'

// Apex marketing + help sitemap. Per-studio sitemaps live at /{slug}/sitemap.xml.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/help`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
  ]

  // Member help articles are public; studio ones are behind auth, so leave them out.
  const memberHelp: MetadataRoute.Sitemap = getAllArticles('member').map(a => ({
    url: `${SITE_URL}/help/member/${a.section}/${a.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.4,
  }))

  return [...staticPages, ...memberHelp]
}
