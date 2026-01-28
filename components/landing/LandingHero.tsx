'use client';

import { useTranslations } from 'next-intl';
import CtaButton from '@/components/CtaButton';

export default function LandingHero() {
  const t = useTranslations('home');

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-5">
      <div className="text-center max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl lg:text-6xl text-white mb-6 font-light leading-tight">
          {t('hero.headline')}
        </h1>

        <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto mb-32 leading-relaxed">
          {t('hero.subheadline')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mt-16">
          <CtaButton
            text={t('hero.cta.secondary')}
            href="/roadmap"
            variant="hero"
          />
        </div>
      </div>

    </div>
  );
}
