'use client';

import dynamic from 'next/dynamic';
import LandingHero from '@/components/landing/LandingHero';
import FeatureSection from '@/components/landing/FeatureSection';
import HowItWorks from '@/components/landing/HowItWorks';
import StatsBar from '@/components/landing/StatsBar';
import ChainLogos from '@/components/landing/ChainLogos';
import CtaSection from '@/components/landing/CtaSection';

const AgentScene = dynamic(
  () => import('@/components/live/AgentScene').then((m) => m.AgentScene),
  { ssr: false }
);

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero with 3D AgentScene from /dreams */}
      <section className="relative h-screen">
        <div className="absolute inset-0">
          <AgentScene />
        </div>
        <LandingHero />
      </section>

      {/* Features */}
      <section className="relative py-20 md:py-32">
        <FeatureSection />
      </section>

      {/* How It Works */}
      <section className="relative py-16 md:py-24 border-t border-gray-500/25">
        <HowItWorks />
      </section>

      {/* Stats */}
      <section className="relative py-12 md:py-16">
        <StatsBar />
      </section>

      {/* Multi-chain Support */}
      <section className="relative py-12 md:py-16 border-t border-gray-500/25">
        <ChainLogos />
      </section>

      {/* Final CTA */}
      <section className="relative py-20 md:py-32">
        <CtaSection />
      </section>
    </div>
  );
}
