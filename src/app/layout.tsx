import "@/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const siteUrl = "https://manoforge.vercel.app";
const siteName = "Mano Forge";
const siteDescription =
  "Mano Forge is a free Mano simulator for Morris Mano's basic computer architecture. Write, assemble, and run Mano assembly with a visual debugger, memory viewer, and register panel.";
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Mano Forge | Mano Simulator",
    template: `%s | ${siteName}`,
  },
  applicationName: siteName,
  description: siteDescription,
  keywords: [
    "mano forge",
    "mano simulator",
    "mano architecture simulator",
    "Mano",
    "Mano computer",
    "Mano simulator",
    "Morris Mano",
    "Morris Mano simulator",
    "basic computer simulator",
    "mano assembly simulator",
    "online mano simulator",
    "computer architecture",
    "assembly language",
    "machine code",
    "CPU simulator",
    "computer system architecture",
    "educational",
    "assembler",
    "debugger",
  ],
  authors: [{ name: "Parv Shah", url: "https://github.com/parv141206" }],
  creator: "Parv Shah",
  publisher: "Parv Shah",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    title: "Mano Forge | Mano Simulator",
    description: siteDescription,
    siteName: siteName,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Mano Forge - Mano Simulator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mano Forge | Mano Simulator",
    description: siteDescription,
    images: ["/og-image.png"],
    creator: "@parv141206",
  },
  alternates: {
    canonical: siteUrl,
  },
  other: {
    "google-site-verification": "ZrgM_UsvqhznNkb_7uUa0YA3JVqi7oEngyM3y1IvW9E",
  },
  category: "education",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: siteName,
        alternateName: ["Mano Simulator", "Morris Mano Simulator"],
        description: siteDescription,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#app`,
        name: "Mano Forge",
        alternateName: ["Mano Simulator"],
        description: siteDescription,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web Browser",
        browserRequirements: "Requires JavaScript",
        isAccessibleForFree: true,
        url: siteUrl,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
    ],
  };

  return (
    <html lang="en" className={`${geist.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link
          rel="icon"
          href="/favicon-32x32.png"
          type="image/png"
          sizes="32x32"
        />
        <link
          rel="icon"
          href="/favicon-16x16.png"
          type="image/png"
          sizes="16x16"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="bg-black">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
