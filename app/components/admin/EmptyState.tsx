import type { ReactNode } from 'react'
import { color } from '@/lib/ui/tokens'

/** Icon, one sentence, at most one action. Used instead of empty tables and empty charts. */
export default function EmptyState({ icon, message, action }: {
  icon?: ReactNode
  message: ReactNode
  action?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '40px 24px', textAlign: 'center' }}>
      {icon && (
        <span aria-hidden style={{
          width: 48, height: 48, borderRadius: '50%', background: color.primarySoft, color: color.primaryInk,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </span>
      )}
      <p style={{ margin: 0, maxWidth: 420, fontSize: 15, lineHeight: 1.45, color: color.ink2 }}>{message}</p>
      {action}
    </div>
  )
}
