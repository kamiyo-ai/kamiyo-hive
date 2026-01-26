import type { Metadata } from "next";

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
  return children;
}
