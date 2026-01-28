'use client';

import dynamic from 'next/dynamic';
import LandingHero from '@/components/landing/LandingHero';

const AgentScene = dynamic(
  () => import('@/components/live/AgentScene').then((m) => m.AgentScene),
  { ssr: false }
);

export default function LandingPage() {
  return (
    <div className="relative h-[calc(100vh-80px)] bg-black">
      {/* Hero with 3D AgentScene */}
      <div className="absolute inset-0">
        <AgentScene hideHUD={true} />
      </div>
      {/* Dim overlay */}
      <div className="absolute inset-0 bg-black/50 pointer-events-none" />
      <LandingHero />
    </div>
  );
}
