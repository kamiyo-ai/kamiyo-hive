'use client';

import { useTranslations } from 'next-intl';
import CtaButton from '@/components/CtaButton';

export default function CtaSection() {
  const t = useTranslations('home');

  return (
    <div className="w-full px-5 mx-auto max-w-[1400px]">
      <div className="relative rounded-2xl border border-gray-500/25 p-8 md:p-16 overflow-hidden">
        {/* Background gradient effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan/5 via-transparent to-magenta/5 pointer-events-none" />

        <div className="relative text-center">
          <h2 className="text-3xl md:text-4xl text-white font-light mb-4">
            {t('cta.headline')}
          </h2>

          <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto mb-8">
            {t('cta.subheadline')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <CtaButton
              text={t('cta.primary')}
              href="/stake"
              variant="hero"
            />
            <CtaButton
              text={t('cta.secondary')}
              href="/governance"
              variant="default"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
