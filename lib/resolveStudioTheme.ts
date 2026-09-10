import { resolveTheme, type StudioTheme } from './studioTheme'

// Server-side theme resolution for the studio tree. Layers the dev-only `cs-theme` cookie override
// on top of the org's stored theme, so `layout.tsx` and each page agree on which theme (and which
// layout variant) is active. Kept out of studioTheme.ts, which client components import and so
// must not pull in `next/headers`. Call only from Server Components / route handlers.
export async function studioThemeForRequest(orgTheme: string | null | undefined): Promise<StudioTheme> {
  let key: string | null | undefined = orgTheme
  if (process.env.NODE_ENV === 'development') {
    const { cookies } = await import('next/headers')
    key = (await cookies()).get('cs-theme')?.value ?? orgTheme
  }
  return resolveTheme(key)
}
