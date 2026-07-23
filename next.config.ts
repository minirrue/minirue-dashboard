import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  async redirects() {
    return [
      { source: "/dashboard", destination: "/overview", permanent: true },
      { source: "/dashboard/:path*", destination: "/:path*", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/overview", destination: "/dashboard" },
      { source: "/products", destination: "/dashboard/products" },
      { source: "/products/new", destination: "/dashboard/products/new" },
      { source: "/products/brands", destination: "/dashboard/products/brands" },
      { source: "/products/global-variants", destination: "/dashboard/products/global-variants" },
      { source: "/products/:slug/edit", destination: "/dashboard/products/:slug/edit" },
      { source: "/categories", destination: "/dashboard/categories" },
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
      { source: "/loyalty", destination: "/dashboard/loyalty" },
      { source: "/admin", destination: "/dashboard/admin" },
      { source: "/settings", destination: "/dashboard/settings" },
      { source: "/info", destination: "/dashboard/info" },
      { source: "/storefront-appearance", destination: "/dashboard/storefront-appearance" },
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
      { source: "/gallery", destination: "/dashboard/gallery" },
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
