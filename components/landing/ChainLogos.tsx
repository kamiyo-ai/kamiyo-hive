'use client';

import { useTranslations } from 'next-intl';

interface ChainInfo {
  name: string;
  status: 'live' | 'coming';
}

export default function ChainLogos() {
  const t = useTranslations('home');

  const chains: ChainInfo[] = [
    { name: 'Solana', status: 'live' },
    { name: 'Base', status: 'live' },
    { name: 'Monad', status: 'coming' },
    { name: 'Hyperliquid', status: 'coming' },
  ];

  return (
    <div className="w-full px-5 mx-auto max-w-[1400px]">
      <div className="text-center mb-8">
        <p className="font-light text-xs uppercase tracking-widest gradient-text mb-4">
          {t('chains.tagline')}
        </p>
        <h2 className="text-2xl md:text-3xl text-white font-light">
          {t('chains.title')}
        </h2>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12">
        {chains.map((chain) => (
          <div
            key={chain.name}
            className={`relative flex flex-col items-center transition-all duration-300 hover:scale-105 ${
              chain.status === 'coming' ? 'opacity-50' : ''
            }`}
          >
            <div className="text-lg md:text-xl text-white font-light mb-1">
              {chain.name}
            </div>
            <span
              className={`text-xs uppercase tracking-wider ${
                chain.status === 'live' ? 'text-cyan' : 'text-gray-500'
              }`}
            >
              {chain.status === 'live' ? t('chains.live') : t('chains.coming')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
