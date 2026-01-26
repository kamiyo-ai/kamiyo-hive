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
            <img
              src="/icons/phantom.png"
              alt="Phantom"
              className="w-10 h-10 rounded-lg"
            />
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
            <img
              src="/icons/solflare.svg"
              alt="Solflare"
              className="w-10 h-10 rounded-lg"
            />
            <div className="flex-1 text-left">
              <div className="text-white font-medium">Solflare</div>
              <div className="text-xs text-gray-500">Web & mobile wallet</div>
            </div>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* MetaMask */}
          <button
            onClick={() => openMobileWallet('metamask')}
            className="w-full flex items-center gap-4 p-4 bg-gray-900/50 border border-gray-500/30 rounded-lg hover:border-orange-500/50 hover:bg-gray-900 transition-all"
          >
            <img
              src="/icons/metamask.svg"
              alt="MetaMask"
              className="w-10 h-10 rounded-lg"
            />
            <div className="flex-1 text-left">
              <div className="text-white font-medium">MetaMask</div>
              <div className="text-xs text-gray-500">Multi-chain wallet</div>
            </div>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Coinbase Wallet */}
          <button
            onClick={() => openMobileWallet('coinbase')}
            className="w-full flex items-center gap-4 p-4 bg-gray-900/50 border border-gray-500/30 rounded-lg hover:border-blue-500/50 hover:bg-gray-900 transition-all"
          >
            <img
              src="/icons/coinbase.png"
              alt="Coinbase Wallet"
              className="w-10 h-10 rounded-lg"
            />
            <div className="flex-1 text-left">
              <div className="text-white font-medium">Coinbase Wallet</div>
              <div className="text-xs text-gray-500">Self-custody wallet</div>
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
