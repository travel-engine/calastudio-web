import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server serve HMR/JS assets to requests coming from this machine's LAN IP —
  // needed to test the booking flow from a phone on the same network (CLAUDE.md's mobile QA
  // requirement). Without this, pages load but never hydrate, so nothing on the page responds.
  allowedDevOrigins: ['192.168.1.138', '192.168.1.46'],

  images: {
    // Studio logos, banners, class and teacher photos all live in the Supabase Storage bucket.
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
};

export default nextConfig;
