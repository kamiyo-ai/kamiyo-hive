'use client';

import { useTranslations } from 'next-intl';
import CtaButton from '@/components/CtaButton';

export default function LandingHero() {
  const t = useTranslations('home');

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-4 sm:px-5">
      <div className="text-center max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl text-white mb-4 sm:mb-6 font-light leading-tight">
          {t('hero.headline')}
        </h1>

        <p className="text-gray-400 text-sm sm:text-base md:text-lg max-w-2xl mx-auto mb-16 sm:mb-24 md:mb-32 leading-relaxed">
          {t('hero.subheadline')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 md:gap-6 mt-8 sm:mt-12 md:mt-16">
          <CtaButton
            text={t('hero.cta.secondary')}
            href="https://kamiyo.ai/roadmap"
            variant="hero"
            external
          />
        </div>
      </div>

    </div>
  );
}
