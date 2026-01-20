import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polar Pulse Web",
  description: "Web rebuild with Supabase backend",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-white">
        {children}
      </body>
    </html>
  );
}