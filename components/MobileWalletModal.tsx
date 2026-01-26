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
              src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSJub25lIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iIzUxMUNBOCIgcng9IjI2Ii8+PHBhdGggZmlsbD0idXJsKCNhKSIgZD0iTTExMC42IDQ2LjZjLTEuMy00LjgtNC4yLTktOC4zLTExLjctNC4xLTIuNy05LTMuOC0xMy44LTMuMS00LjguNy05LjIgMy4xLTEyLjMgNi43bC0xMi4yIDE0Yy0xLjYgMS45LTQuMSAyLjktNi42IDIuNy0yLjUtLjItNC44LTEuNS02LjEtMy42TDM4LjggMzFjLTMuMy01LjItOC43LTguNy0xNC44LTkuNS02LjEtLjgtMTIuMiAxLjItMTYuOCA1LjQtNC42IDQuMi03LjIgMTAuMi03IDE2LjQuMiA2LjIgMy4yIDEyIDguMiAxNS44bDQyLjggMzIuOGMyLjIgMS43IDMuNSA0LjMgMy41IDcuMXYxNC45YzAgNC40IDIuNiA4LjQgNi43IDEwLjEgNC4xIDEuNyA4LjguOCAxMS45LTIuM2w4LjUtOC41YzIuMS0yLjEgMy4zLTUgMy4zLTh2LTE4LjVjMC0yLjggMS4zLTUuNCAzLjUtNy4xbDE4LjQtMTQuMWM1LTMuOCA4LTkuNiA4LjItMTUuOC4yLTMuMS0uNC02LjItMS42LTkuMXoiLz48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImEiIHgxPSI2NCIgeDI9IjY0IiB5MT0iMjAiIHkyPSIxMjAiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj48c3RvcCBzdG9wLWNvbG9yPSIjZmZmIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZmZmIiBzdG9wLW9wYWNpdHk9Ii43OCIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjwvc3ZnPg=="
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
              src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSJub25lIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iI0ZDNTMxRCIgcng9IjI2Ii8+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTk4LjUgNTguMmwtMjktMTYuN2MtNC41LTIuNi0xMC0yLjYtMTQuNSAwbC0yOSAxNi43Yy00LjUgMi42LTcuMiA3LjQtNy4yIDEyLjZ2MzMuNWMwIDUuMiAyLjcgMTAgNy4yIDEyLjZsMjkgMTYuN2M0LjUgMi42IDEwIDIuNiAxNC41IDBsMjktMTYuN2M0LjUtMi42IDcuMi03LjQgNy4yLTEyLjZWNzAuOGMwLTUuMi0yLjctMTAtNy4yLTEyLjZ6bS0zNS41IDU0LjVjLTEwLjggMC0xOS41LTguNy0xOS41LTE5LjVzOC43LTE5LjUgMTkuNS0xOS41IDE5LjUgOC43IDE5LjUgMTkuNS04LjcgMTkuNS0xOS41IDE5LjV6Ii8+PC9zdmc+"
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
