import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeScript } from "@/components/theme/theme-script";
import { RegisterSW } from "@/components/pwa/register-sw";

/**
 * Inter, self-hosted via next/font (no external request at runtime). Variable
 * font carries the full 400–700 range Phila uses; tabular numerals are applied
 * in CSS on data surfaces (DESIGN.md §3).
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://philasa.com"),
  title: {
    default: "Phila  run the practice, hold the whole journey",
    template: "%s · Phila",
  },
  description:
    "A calm, POPIA-grade operations platform for South African counselling organisations  the daily clinical loop, programme oversight, and funder reporting that falls out of the work.",
  applicationName: "Phila",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Phila", statusBarStyle: "default" },
  icons: { icon: "/favicon.ico", apple: "/icons/icon-192.png" },
  // The product is private by default; the public marketing/org pages opt back in.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // 360px-first; the theme background colour follows the active theme.
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1210" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      {/* suppressHydrationWarning: some browser extensions inject attributes onto
          <body> (e.g. bis_register, __processed_*) before React hydrates. That's
          outside our control; this suppresses only the body element's own attribute
          diff (one level deep), not the tree. */}
      <body className="flex min-h-full flex-col bg-bg text-text" suppressHydrationWarning>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
