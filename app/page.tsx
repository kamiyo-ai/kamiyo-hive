'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import CtaButton from '@/components/CtaButton';
import Footer from '@/components/Footer';
import Typewriter from '@/components/Typewriter';

const ParticleScene = dynamic(() => import('@/components/ParticleScene'), {
  ssr: false,
});

export default function Home() {
  const [sceneReady, setSceneReady] = useState(false);

  return (
    <>
      <style>{`
        body > div > main + div { display: none !important; }
      `}</style>
      <div className="relative w-full h-[calc(100vh-var(--header-height))] flex flex-col bg-black overflow-hidden">
        <div className="absolute inset-0">
          <ParticleScene count={200} onReady={() => setSceneReady(true)} />
        </div>

        {/* Vignette overlay - black with transparent center hole */}
        <div
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{
            background: 'radial-gradient(circle at 50% 50%, transparent 20%, black 60%)',
            opacity: sceneReady ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
        />

        {/* Full black cover until scene ready */}
        <div
          className="absolute inset-0 bg-black pointer-events-none z-[2]"
          style={{
            opacity: sceneReady ? 0 : 1,
            transition: 'opacity 0.5s ease',
          }}
        />

        <div className="flex-1 flex flex-col items-center justify-center z-10 gap-6">
          <h1 className="text-[1.75rem] md:text-[2.25rem] text-white tracking-wider text-center leading-snug pb-4">
            <Typewriter text="The KAMIYO Trials have begun..." speed={50} />
          </h1>
          <CtaButton text="Enter Trials" href="/trials" variant="hero" />
        </div>

        <div className="relative z-10">
          <Footer />
        </div>
      </div>
    </>
  );
}
