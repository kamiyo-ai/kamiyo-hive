'use client';

import { useTranslations } from 'next-intl';
import FeatureCard from './FeatureCard';

export default function FeatureSection() {
  const t = useTranslations('home');

  const features = [
    {
      key: 'identity',
      href: '/escrow',
    },
    {
      key: 'escrow',
      href: '/escrow',
    },
    {
      key: 'governance',
      href: '/governance',
    },
    {
      key: 'staking',
      href: '/stake',
    },
    {
      key: 'swarm',
      href: '/swarm',
    },
    {
      key: 'multichain',
      href: '/roadmap',
    },
  ];

  return (
    <div className="w-full px-5 mx-auto max-w-[1400px]">
      <div className="text-center mb-12">
        <p className="font-light text-xs uppercase tracking-widest gradient-text mb-4">
          {t('features.tagline')}
        </p>
        <h2 className="text-3xl md:text-4xl text-white font-light">
          {t('features.title')}
        </h2>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {features.map((feature) => (
          <FeatureCard
            key={feature.key}
            title={t(`features.${feature.key}.title`)}
            description={t(`features.${feature.key}.description`)}
            href={feature.href}
          />
        ))}
      </div>
    </div>
  );
}
