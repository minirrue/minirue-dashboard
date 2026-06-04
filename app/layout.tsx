import type { Metadata } from "next";
import "../styles/globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
