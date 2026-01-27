'use client';

import { useTranslations } from 'next-intl';

export default function HowItWorks() {
  const t = useTranslations('home');

  const steps = [
    { key: 'register', number: '01' },
    { key: 'reputation', number: '02' },
    { key: 'transact', number: '03' },
    { key: 'scale', number: '04' },
  ];

  return (
    <div className="w-full px-5 mx-auto max-w-[1400px]">
      <div className="text-center mb-12">
        <p className="font-light text-xs uppercase tracking-widest gradient-text mb-4">
          {t('howItWorks.tagline')}
        </p>
        <h2 className="text-3xl md:text-4xl text-white font-light">
          {t('howItWorks.title')}
        </h2>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
        {steps.map((step, index) => (
          <div key={step.key} className="relative">
            {/* Connector line - hidden on mobile, visible on larger screens */}
            {index < steps.length - 1 && (
              <div className="hidden lg:block absolute top-8 left-[calc(50%+24px)] w-[calc(100%-48px)] h-px bg-gradient-to-r from-cyan/50 to-magenta/50" />
            )}

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-gray-500/25 mb-6">
                <span className="gradient-text text-xl font-light">{step.number}</span>
              </div>

              <h3 className="text-lg text-white mb-3">
                {t(`howItWorks.steps.${step.key}.title`)}
              </h3>

              <p className="text-sm text-gray-500 leading-relaxed">
                {t(`howItWorks.steps.${step.key}.description`)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
