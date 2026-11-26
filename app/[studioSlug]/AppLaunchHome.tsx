'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { studioPath } from '@/lib/seo'

// Opening the installed studio app always lands on the member's Home (My account → Home; the
// sign-in form there when signed out). The manifest's start_url points there, but apps installed
// before that change (iOS keeps the start_url from install time) still open on the schedule or the
// home page, so the first page of each app launch is redirected too. Only the launch page, and
// only in the installed app: links into the app and normal browser visits are left alone.
const LAUNCH_KEY = 'cs-app-launched'

export default function AppLaunchHome({ studioSlug }: { studioSlug: string }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (!standalone) return
    try {
      if (sessionStorage.getItem(LAUNCH_KEY)) return
      sessionStorage.setItem(LAUNCH_KEY, '1')
    } catch { return }
    const launchPages = [studioPath(studioSlug, '/'), studioPath(studioSlug, '/schedule')]
    if (launchPages.includes(pathname)) router.replace(studioPath(studioSlug, '/account?tab=home'))
    // Only the first page of a launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
