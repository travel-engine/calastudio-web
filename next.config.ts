import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Lets the dev server serve HMR/JS assets to requests coming from this machine's LAN IP —
  // needed to test the booking flow from a phone on the same network (CLAUDE.md's mobile QA
  // requirement). Without this, pages load but never hydrate, so nothing on the page responds.
  allowedDevOrigins: ['192.168.1.138', '192.168.1.46'],
};

export default nextConfig;
