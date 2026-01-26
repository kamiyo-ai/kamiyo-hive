'use client';

import { useEffect } from 'react';
import { useMobileWallet } from '@/hooks/useMobileWallet';

interface MobileWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDesktopConnect: () => void;
}

export function MobileWalletModal({ isOpen, onClose, onDesktopConnect }: MobileWalletModalProps) {
  const { isMobile, isInWalletBrowser, openMobileWallet } = useMobileWallet();

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // If on desktop or inside wallet browser, use standard wallet adapter
  if (!isMobile || isInWalletBrowser) {
    // Trigger standard wallet modal and close this one
    onDesktopConnect();
    onClose();
    return null;
  }

  // Mobile-specific wallet selection
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-black border border-gray-500/50 rounded-xl w-[90%] max-w-sm p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-white">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-6">
          Select a wallet to open and connect. You&apos;ll be redirected to the wallet app.
        </p>

        <div className="space-y-3">
          {/* Phantom */}
          <button
            onClick={() => openMobileWallet('phantom')}
            className="w-full flex items-center gap-4 p-4 bg-gray-900/50 border border-gray-500/30 rounded-lg hover:border-purple-500/50 hover:bg-gray-900 transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 128 128" fill="white">
                <path d="M110.6 46.6c-1.3-4.8-4.2-9-8.3-11.7-4.1-2.7-9-3.8-13.8-3.1-4.8.7-9.2 3.1-12.3 6.7l-12.2 14c-1.6 1.9-4.1 2.9-6.6 2.7-2.5-.2-4.8-1.5-6.1-3.6L38.8 31c-3.3-5.2-8.7-8.7-14.8-9.5-6.1-.8-12.2 1.2-16.8 5.4-4.6 4.2-7.2 10.2-7 16.4.2 6.2 3.2 12 8.2 15.8l42.8 32.8c2.2 1.7 3.5 4.3 3.5 7.1v14.9c0 4.4 2.6 8.4 6.7 10.1 4.1 1.7 8.8.8 11.9-2.3l8.5-8.5c2.1-2.1 3.3-5 3.3-8V86.7c0-2.8 1.3-5.4 3.5-7.1l18.4-14.1c5-3.8 8-9.6 8.2-15.8.2-3.1-.4-6.2-1.6-9z"/>
              </svg>
            </div>
            <div className="flex-1 text-left">
              <div className="text-white font-medium">Phantom</div>
              <div className="text-xs text-gray-500">Popular Solana wallet</div>
            </div>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Solflare */}
          <button
            onClick={() => openMobileWallet('solflare')}
            className="w-full flex items-center gap-4 p-4 bg-gray-900/50 border border-gray-500/30 rounded-lg hover:border-orange-500/50 hover:bg-gray-900 transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="flex-1 text-left">
              <div className="text-white font-medium">Solflare</div>
              <div className="text-xs text-gray-500">Web & mobile wallet</div>
            </div>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-gray-600 mt-6 text-center">
          Don&apos;t have a wallet?{' '}
          <a
            href="https://phantom.app/download"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300"
          >
            Download Phantom
          </a>
        </p>
      </div>
    </div>
  );
}
