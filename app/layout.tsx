import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import GlitchBackground from "@/components/GlitchBackground";

export const metadata: Metadata = {
  title: "KAMIYO App - Governance & Staking",
  description: "Governance and staking for the KAMIYO protocol",
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
        <link rel="icon" type="image/png" href="/media/kamiyo.png" />
      </head>
      <body className="bg-black text-gray-300 min-h-screen flex flex-col">
        <Providers>
          <Header />
          <main className="pt-[var(--header-height)] flex-1">
            {children}
          </main>
          <div className="relative">
            <div
              className="absolute left-0 right-0 h-[800px] z-0 pointer-events-none"
              style={{
                bottom: 0,
                maskImage: 'linear-gradient(to top, transparent 0%, black 35%, black 45%, transparent 60%), linear-gradient(to right, transparent 0%, black 25%, black 75%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to top, transparent 0%, black 35%, black 45%, transparent 60%), linear-gradient(to right, transparent 0%, black 25%, black 75%, transparent 100%)',
                maskComposite: 'intersect',
                WebkitMaskComposite: 'source-in',
              }}
            >
              <GlitchBackground />
            </div>
            <div className="pb-[24rem]" />
            <div className="relative z-10">
              <Footer />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
