'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function TrialsPage() {
  const t = useTranslations('trials');

  return (
    <div className="bg-black text-white">
      <div className="w-full px-5 mx-auto max-w-[1400px] pt-24 md:pt-28 pb-8 md:pb-16">
        <div className="min-h-[calc(100vh-200px)] flex flex-col justify-center text-center">
          <p className="font-light text-sm uppercase tracking-widest gradient-text mb-4">
            — Trials トライアル
          </p>
          <h1 className="text-3xl md:text-4xl font-medium mb-4">{t('title')}</h1>

          {/* Concluded Banner */}
          <div className="bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 border border-gray-500/25 rounded-lg p-8 mb-8 max-w-2xl mx-auto">
            <h2 className="text-2xl text-white mb-4">Trials Have Concluded</h2>
            <p className="text-gray-400 mb-6">
              The oracle trials qualification period has ended. Thank you to all participants who competed for a spot on the leaderboard.
            </p>
            <Link
              href="/trials/leaderboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-gray-700 hover:border-cyan/50 text-white text-sm rounded transition-colors"
            >
              View Final Leaderboard
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Info Cards */}
          <div className="grid md:grid-cols-3 gap-4 mt-12 max-w-4xl mx-auto">
            <div className="bg-black border border-gray-500/25 rounded-lg p-6 text-center">
              <div className="gradient-text text-xs uppercase tracking-wider mb-2">Status</div>
              <div className="text-white text-lg">Concluded</div>
            </div>
            <div className="bg-black border border-gray-500/25 rounded-lg p-6 text-center">
              <div className="gradient-text text-xs uppercase tracking-wider mb-2">Participants</div>
              <div className="text-white text-lg">1,247</div>
            </div>
            <div className="bg-black border border-gray-500/25 rounded-lg p-6 text-center">
              <div className="gradient-text text-xs uppercase tracking-wider mb-2">Prize Pool</div>
              <div className="text-white text-lg">100,000 $KAMIYO</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
