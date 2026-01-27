'use client';

import { useTranslations } from 'next-intl';
import Typewriter from '@/components/Typewriter';
import CtaButton from '@/components/CtaButton';

export default function LandingHero() {
  const t = useTranslations('home');

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-5">
      <div className="text-center max-w-4xl mx-auto">
        <p className="font-light text-xs uppercase tracking-widest gradient-text mb-6">
          {t('hero.tagline')}
        </p>

        <h1 className="text-4xl md:text-5xl lg:text-6xl text-white mb-6 font-light leading-tight">
          <Typewriter
            text={t('hero.headline')}
            speed={40}
          />
        </h1>

        <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          {t('hero.subheadline')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
          <CtaButton
            text={t('hero.cta.primary')}
            href="/stake"
            variant="hero"
          />
          <CtaButton
            text={t('hero.cta.secondary')}
            href="/roadmap"
            variant="default"
          />
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg
          className="w-6 h-6 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </div>
    </div>
  );
}
