'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// Last-resort screen when the root layout itself fails to render. Reports the error, then offers
// a reload. Kept plain: the app's own styles and fonts may be what failed.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error) }, [error])

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', margin: 0, background: '#f4f4f4' }}>
        <div style={{ textAlign: 'center', padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ color: '#555', margin: '0 0 20px' }}>Sorry, this page couldn&rsquo;t load. Please try again.</p>
          <button type="button" onClick={() => reset()} style={{ padding: '12px 20px', border: 0, borderRadius: 8, background: '#085041', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
