'use client'

import { useEffect } from 'react'
import { scanForMojibake } from '@/lib/mojibake'

// Development-only: wraps window.fetch so every request body and every JSON response is scanned
// for mojibake (see lib/mojibake). One mount point in the root layout covers the whole app — no
// per-call or per-field wiring. Logs a console warning with the endpoint and the offending paths;
// it never blocks or rewrites anything.
//
// In production this is not rendered. If you want a production signal, replace the console.warn
// with a call to your error reporter.
export default function MojibakeCanary() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const orig = window.fetch
    if ((orig as { __mojibakeWrapped?: boolean }).__mojibakeWrapped) return

    const wrapped: typeof window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url

      // Outgoing body
      const body = init?.body
      if (typeof body === 'string') {
        try {
          const hits = scanForMojibake(JSON.parse(body))
          if (hits.length) console.warn(`[mojibake] outgoing → ${url}`, hits)
        } catch {
          /* not JSON — ignore */
        }
      }

      const res = await orig(input as RequestInfo, init)

      // Incoming JSON
      if (res.headers.get('content-type')?.includes('application/json')) {
        res
          .clone()
          .json()
          .then((data) => {
            const hits = scanForMojibake(data)
            if (hits.length) console.warn(`[mojibake] response ← ${url}`, hits)
          })
          .catch(() => {})
      }
      return res
    }
    ;(wrapped as { __mojibakeWrapped?: boolean }).__mojibakeWrapped = true
    window.fetch = wrapped
    return () => {
      window.fetch = orig
    }
  }, [])

  return null
}
