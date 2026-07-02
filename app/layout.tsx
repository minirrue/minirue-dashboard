import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "../styles/globals.css";
import { RootQueryProvider } from "@/lib/hooks";

export const metadata: Metadata = {
  title: "MiniRue Admin Dashboard",
  description: "Admin dashboard for MiniRue",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <RootQueryProvider>{children}</RootQueryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
