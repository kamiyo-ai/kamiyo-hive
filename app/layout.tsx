import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import GlitchBackground from "@/components/GlitchBackground";

export const metadata: Metadata = {
  title: "KAMIYO",
  description: "Trust layer for AI agents",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "KAMIYO",
    description: "Trust layer for AI agents",
    url: "https://app.kamiyo.ai",
    siteName: "KAMIYO",
    images: [
      {
        url: "https://kamiyo.ai/media/kamiyo_open-graph.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KAMIYO",
    description: "Trust layer for AI agents",
    images: ["https://kamiyo.ai/media/kamiyo_open-graph.png"],
    site: "@KamiyoAI",
    creator: "@KamiyoAI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@200;300;400&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-black text-gray-300 min-h-screen flex flex-col">
        <Providers>
          <Header />
          <main className="pt-[var(--header-height)] flex-1">
            {children}
          </main>
          <div className="relative mt-auto overflow-hidden" id="layout-footer-section">
            <div
              className="absolute inset-x-0 bottom-0 h-[800px] z-0 pointer-events-none"
              style={{
                maskImage: 'linear-gradient(to top, transparent 0%, black 35%, black 45%, transparent 60%), linear-gradient(to right, transparent 0%, black 25%, black 75%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to top, transparent 0%, black 35%, black 45%, transparent 60%), linear-gradient(to right, transparent 0%, black 25%, black 75%, transparent 100%)',
                maskComposite: 'intersect',
                WebkitMaskComposite: 'source-in',
              }}
            >
              <GlitchBackground />
            </div>
            <div className="pt-[24rem]" />
            <div className="relative z-10">
              <Footer />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
