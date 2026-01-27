'use client';

import { useTranslations } from 'next-intl';

export default function StatsBar() {
  const t = useTranslations('home');

  const stats = [
    { key: 'tvl', value: '$1.2M', sublabel: 'across all products' },
    { key: 'agents', value: '2,500+', sublabel: 'registered' },
    { key: 'transactions', value: '50,000+', sublabel: 'processed' },
    { key: 'chains', value: '4', sublabel: 'supported' },
  ];

  return (
    <div className="w-full px-5 mx-auto max-w-[1400px]">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className="bg-black border border-gray-500/25 rounded-lg p-5 text-center"
          >
            <div className="gradient-text text-xs uppercase tracking-wider mb-2">
              {t(`stats.${stat.key}`)}
            </div>
            <div className="text-white text-2xl md:text-3xl font-light mb-1">
              {stat.value}
            </div>
            <div className="text-gray-500 text-xs">
              {stat.sublabel}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
