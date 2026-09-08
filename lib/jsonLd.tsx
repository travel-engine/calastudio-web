// Schema.org JSON-LD for the public studio pages. Builders return plain objects; <JsonLd> drops
// them into a <script type="application/ld+json"> (server-rendered, so crawlers see it in the HTML).

export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // Escape "<" so a value can't close the script tag early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}

interface StudioLdInput {
  name: string
  description: string | null
  url: string
  image?: string | null
}

export function studioLd(s: StudioLdInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: s.name,
    url: s.url,
    ...(s.description ? { description: s.description } : {}),
    ...(s.image ? { image: s.image } : {}),
  }
}

interface OccurrenceLdInput {
  session_name: string
  starts_at: string
  ends_at: string
  delivery_mode: string
  location_name: string | null
  location_address: string | null
  instructor_name: string | null
  price: number | null
  currency: string
  spots_remaining: number | null
  is_cancelled: boolean
  photo_url?: string | null
}

export function eventLd(o: OccurrenceLdInput, ctx: { studioName: string; studioUrl: string; pageUrl: string }) {
  const online = o.delivery_mode === 'online'
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: o.session_name,
    startDate: o.starts_at,
    endDate: o.ends_at,
    eventAttendanceMode: online
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: o.is_cancelled ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    location: online
      ? { '@type': 'VirtualLocation', url: ctx.pageUrl }
      : {
          '@type': 'Place',
          name: o.location_name || ctx.studioName,
          ...(o.location_address ? { address: o.location_address } : {}),
        },
    organizer: { '@type': 'Organization', name: ctx.studioName, url: ctx.studioUrl },
    ...(o.instructor_name ? { performer: { '@type': 'Person', name: o.instructor_name } } : {}),
    ...(o.photo_url ? { image: o.photo_url } : {}),
    ...(o.price != null
      ? {
          offers: {
            '@type': 'Offer',
            price: o.price,
            priceCurrency: o.currency,
            url: ctx.pageUrl,
            availability:
              o.spots_remaining != null && o.spots_remaining <= 0
                ? 'https://schema.org/SoldOut'
                : 'https://schema.org/InStock',
          },
        }
      : {}),
  }
}

interface PersonLdInput {
  display_name: string
  bio: string | null
  tagline: string | null
  photo_url: string | null
  instagram_url: string | null
  website_url: string | null
}

export function personLd(p: PersonLdInput, ctx: { studioName: string; studioUrl: string; pageUrl: string }) {
  const sameAs = [p.instagram_url, p.website_url].filter((u): u is string => !!u)
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.display_name,
    jobTitle: p.tagline || 'Teacher',
    url: ctx.pageUrl,
    ...(p.photo_url ? { image: p.photo_url } : {}),
    ...(p.bio ? { description: p.bio } : {}),
    worksFor: { '@type': 'Organization', name: ctx.studioName, url: ctx.studioUrl },
    ...(sameAs.length ? { sameAs } : {}),
  }
}

export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  }
}

interface PassLdInput {
  name: string
  description: string | null
  price: number
  currency: string
}

export function passProductLd(p: PassLdInput, ctx: { studioName: string; pageUrl: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    ...(p.description ? { description: p.description } : {}),
    brand: { '@type': 'Organization', name: ctx.studioName },
    offers: {
      '@type': 'Offer',
      price: p.price,
      priceCurrency: p.currency,
      url: ctx.pageUrl,
      availability: 'https://schema.org/InStock',
    },
  }
}
