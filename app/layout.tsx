import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = "https://gamelens.himank.dev";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "GameLens — Free Chess Game Analysis with Stockfish",
    template: "%s | GameLens",
  },
  description:
    "Analyze your chess games for free in your browser. Paste a PGN or load from chess.com / Lichess — Stockfish 18 gives you move-by-move accuracy %, blunders, missed wins, best-move suggestions, and blunder puzzles. No signup required.",
  keywords: [
    "chess game analysis",
    "chess game review",
    "analyze chess game",
    "free chess analyzer",
    "chess blunder finder",
    "Stockfish chess",
    "PGN analyzer",
    "chess accuracy",
    "chess mistakes",
    "chess improvement",
    "lichess game review",
    "chess.com game analysis",
    "chess move coach",
  ],
  authors: [{ name: "GameLens" }],
  creator: "GameLens",
  publisher: "GameLens",
  category: "Chess Tools",
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "GameLens",
    title: "GameLens — Free Chess Game Analysis with Stockfish",
    description:
      "Analyze your chess games for free. Stockfish 18 move-by-move review: accuracy %, blunders, missed wins, best-move suggestions. Runs entirely in your browser.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "GameLens — Free Chess Game Analysis",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GameLens — Free Chess Game Analysis with Stockfish",
    description:
      "Analyze your chess games for free. Stockfish 18 move-by-move review: accuracy %, blunders, missed wins. Runs entirely in your browser.",
    images: ["/opengraph-image"],
  },
  alternates: {
    canonical: BASE_URL,
  },
  verification: {
    google: "uHHKdLMdOQUjupa5dixSzVllodvBX6O5LiYMhJvvSyg",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/png" },
      { url: "/gamelens-icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [{ rel: "manifest-icon", url: "/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "GameLens",
    url: BASE_URL,
    description:
      "Free chess game analysis powered by Stockfish 18. Paste a PGN or load from chess.com / Lichess for move-by-move review with accuracy %, blunder detection, and best-move suggestions.",
    applicationCategory: "GameApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires a modern browser with WebAssembly support",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Move-by-move chess game analysis",
      "Blunder and mistake detection",
      "Best move suggestions",
      "Accuracy percentage per player",
      "Puzzle training from your own mistakes",
      "Lichess and chess.com game import",
      "Stockfish 18 engine",
      "No signup required",
    ],
  };

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className="min-h-full flex flex-col"
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
