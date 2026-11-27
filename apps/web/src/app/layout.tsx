import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import { GeistMono } from "geist/font/mono";
import { ThemeScript } from "@/components/theme/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PolicyPulse · Hexaware",
    template: "%s · PolicyPulse",
  },
  description:
    "Regulatory change, reviewed and on record: ingested circulars, verified citations, policy changes, assignments, and an immutable audit trail.",
  applicationName: "PolicyPulse",
  robots: { index: false, follow: false },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f8f9" },
    { media: "(prefers-color-scheme: dark)", color: "#050507" },
  ],
  colorScheme: "light dark" as const,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistMono.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh bg-canvas font-sans text-fg antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
