import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Hexa Compliance Copilot",
    template: "%s · Hexa Compliance Copilot",
  },
  description:
    "An AI-assisted regulatory change and compliance copilot: clause-cited obligations, policy gap assessment, human-reviewed redlines, and an immutable audit trail.",
  applicationName: "Hexa Compliance Copilot",
  robots: { index: false, follow: false },
};

export const viewport = {
  themeColor: "#f8f8f9",
  colorScheme: "light" as const,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistMono.variable}>
      <body className="min-h-dvh bg-canvas font-sans text-fg antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
