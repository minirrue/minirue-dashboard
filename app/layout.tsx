import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import "../styles/globals.css";
import { RootQueryProvider, getQueryClient } from "@/lib/hooks";

export const metadata: Metadata = {
  title: "MiniRue Admin Dashboard",
  description: "Admin dashboard for MiniRue",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <RootQueryProvider>
          <HydrationBoundary state={dehydrate(queryClient)}>
            {children}
          </HydrationBoundary>
        </RootQueryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
