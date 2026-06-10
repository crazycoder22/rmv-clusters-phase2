import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    // SVG ad banners (e.g. /public/banners/*.svg) need this flag. The CSP
    // sandboxes any rendered SVG so embedded scripts can't run, and only
    // admins can upload ad images, so the residual risk is minimal.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  // Bazaar merged under Food (one section). Keep old shared /bazaar links working.
  async redirects() {
    return [
      { source: "/bazaar", destination: "/food", permanent: true },
      { source: "/bazaar/menus/:id", destination: "/food/menus/:id", permanent: true },
      { source: "/bazaar/menus/:id/edit", destination: "/food/menus/:id/edit", permanent: true },
      { source: "/bazaar/menus/new", destination: "/food/stalls/new", permanent: true },
    ];
  },
};

export default nextConfig;
