import Link from 'next/link'
import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
import { color } from '@/lib/ui/tokens'
import ui from './admin.module.css'

/** "Schedule › Sat 17 Oct" — the last item is the current page (no link, aria-current). */
export default function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, margin: 0, padding: 0, listStyle: 'none', fontSize: 14 }}>
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li>
                {item.href && !last ? (
                  <Link href={item.href} className={ui.focusable} style={{ color: color.primary, fontWeight: 600, textDecoration: 'none' }}>
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? 'page' : undefined} style={{ color: color.muted }}>{item.label}</span>
                )}
              </li>
              {!last && <li aria-hidden style={{ display: 'flex', color: color.muted }}><ChevronRight size={16} strokeWidth={1.8} /></li>}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
