import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tower of English — Climb to Floor 10",
  description:
    "A gamified two-team English learning race built with Next.js, Supabase Realtime and Framer Motion.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
