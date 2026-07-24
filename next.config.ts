import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy. frame-ancestors/object-src/base-uri/form-action are
// enforced strictly (they don't affect rendering, so zero breakage risk).
// NOTE: script-src still allows 'unsafe-inline' because Next's App Router
// injects inline hydration scripts. TODO(security): move to a nonce-based
// script-src via proxy/middleware and drop 'unsafe-inline'. Dev adds
// 'unsafe-eval' + ws/http so HMR keeps working.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https:${isProd ? "" : " ws: wss: http:"}`,
  "frame-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/overview", permanent: true },
      { source: "/dashboard/:path*", destination: "/:path*", permanent: true },
      // Catalogue moved under one /catalogue parent (2026-07-24). Old links and
      // bookmarks still work — they land on the new sub-tab. Specific paths
      // MUST come before the bare /products, or /products would swallow them.
      { source: "/products/overview", destination: "/catalogue", permanent: true },
      { source: "/products/new", destination: "/catalogue/products/new", permanent: true },
      { source: "/products/brands", destination: "/catalogue/brands", permanent: true },
      { source: "/products/global-variants", destination: "/catalogue/global-variants", permanent: true },
      { source: "/products/:slug/edit", destination: "/catalogue/products/:slug/edit", permanent: true },
      { source: "/products", destination: "/catalogue/products", permanent: true },
      { source: "/categories", destination: "/catalogue/categories", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/overview", destination: "/dashboard" },
      // Catalogue: one /catalogue parent, slash sub-tabs. The app-router files
      // stay under /dashboard/products and /dashboard/categories; only the
      // public URL changed. Specific paths before /catalogue/products.
      { source: "/catalogue", destination: "/dashboard/products/overview" },
      { source: "/catalogue/products/new", destination: "/dashboard/products/new" },
      { source: "/catalogue/products/:slug/edit", destination: "/dashboard/products/:slug/edit" },
      { source: "/catalogue/products", destination: "/dashboard/products" },
      { source: "/catalogue/brands", destination: "/dashboard/products/brands" },
      { source: "/catalogue/global-variants", destination: "/dashboard/products/global-variants" },
      { source: "/catalogue/categories", destination: "/dashboard/categories" },
      { source: "/orders", destination: "/dashboard/orders" },
      { source: "/orders/:slug", destination: "/dashboard/orders/:slug" },
      { source: "/customers", destination: "/dashboard/customers" },
      { source: "/customers/:userId", destination: "/dashboard/customers/:userId" },
      { source: "/fulfillment", destination: "/dashboard/fulfillment" },
      { source: "/refunds", destination: "/dashboard/refunds" },
      { source: "/inventory", destination: "/dashboard/inventory" },
      { source: "/inventory/movements", destination: "/dashboard/inventory/movements" },
      { source: "/inventory/receive", destination: "/dashboard/inventory/receive" },
      { source: "/inventory/warehouses", destination: "/dashboard/inventory/warehouses" },
      { source: "/analytics", destination: "/dashboard/analytics" },
      { source: "/support", destination: "/dashboard/support" },
      { source: "/loyalty", destination: "/dashboard/loyalty" },
      { source: "/admin", destination: "/dashboard/admin" },
      { source: "/settings", destination: "/dashboard/settings" },
      { source: "/info", destination: "/dashboard/info" },
      { source: "/storefront-appearance", destination: "/dashboard/storefront-appearance" },
      { source: "/partners", destination: "/dashboard/partners" },
      { source: "/collaborators", destination: "/dashboard/collaborators" },
      { source: "/collaborators/new", destination: "/dashboard/collaborators/new" },
      { source: "/collaborators/review", destination: "/dashboard/collaborators/review" },
      { source: "/collaborators/:id", destination: "/dashboard/collaborators/:id" },
      { source: "/collab", destination: "/dashboard/collab" },
      { source: "/collab/workspace", destination: "/dashboard/collab/workspace" },
      { source: "/collab/orders", destination: "/dashboard/collab/orders" },
      { source: "/collab/products", destination: "/dashboard/collab/products" },
      { source: "/collab/products/new", destination: "/dashboard/collab/products/new" },
      { source: "/collab/products/:id/edit", destination: "/dashboard/collab/products/:id/edit" },
      { source: "/collab/brand", destination: "/dashboard/collab/brand" },
      { source: "/collab/analytics", destination: "/dashboard/collab/analytics" },
      { source: "/collab/support", destination: "/dashboard/collab/support" },
      { source: "/gallery", destination: "/dashboard/gallery" },
      { source: "/notifications", destination: "/dashboard/notifications" },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "source.unsplash.com" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
