import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polar Pulse Web",
  description: "Web rebuild with Supabase backend",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-zinc-950 text-white">
        {/* If you have a separate /app layout that renders the bottom nav,
            keep this root layout simple. */}
        {children}
      </body>
    </html>
  );
}