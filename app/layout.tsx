import type { Metadata, Viewport } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Yanzx AI — AI Full-Stack Website Builder",
    template: "%s · Yanzx AI",
  },
  description:
    "Describe your product. Yanzx AI generates the frontend, the backend routes and the database schema — in one focused workspace.",
  applicationName: "Yanzx AI",
  keywords: [
    "AI website builder",
    "full-stack generator",
    "Next.js",
    "Prisma",
    "Supabase",
    "Yanzx AI",
  ],
  authors: [{ name: "Yanzx AI" }],
  openGraph: {
    title: "Yanzx AI — AI Full-Stack Website Builder",
    description:
      "Frontend, backend and database generated from one prompt. Review the code, preview it live, ship it.",
    type: "website",
    siteName: "Yanzx AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Yanzx AI — AI Full-Stack Website Builder",
    description: "Frontend, backend and database generated from one prompt.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#090D16",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
