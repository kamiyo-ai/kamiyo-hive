'use client';

import { useCallback, useEffect, useState } from 'react';

export function useMobileWallet() {
  const [isMobile, setIsMobile] = useState(false);
  const [isInWalletBrowser, setIsInWalletBrowser] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect mobile device
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    setIsMobile(mobile);

    // Detect if we're inside a wallet's in-app browser
    // Phantom injects window.phantom, Solflare injects window.solflare
    const inWalletBrowser = !!(
      (window as unknown as { phantom?: { solana?: unknown } }).phantom?.solana ||
      (window as unknown as { solflare?: unknown }).solflare ||
      (window as unknown as { solana?: { isPhantom?: boolean } }).solana?.isPhantom
    );
    setIsInWalletBrowser(inWalletBrowser);
  }, []);

  // Build deep link URL for mobile wallets
  const buildDeepLink = useCallback((wallet: 'phantom' | 'solflare' | 'metamask') => {
    if (typeof window === 'undefined') return '';

    const currentUrl = encodeURIComponent(window.location.href);

    if (wallet === 'phantom') {
      // Phantom uses phantom:// protocol or universal link
      // https://docs.phantom.app/developer-powertools/deeplinks/provider/connect
      const ref = encodeURIComponent(window.location.origin);
      return `https://phantom.app/ul/browse/${currentUrl}?ref=${ref}`;
    }

    if (wallet === 'solflare') {
      // Solflare uses solflare:// protocol
      // https://docs.solflare.com/solflare/technical/deeplinks
      return `https://solflare.com/ul/v1/browse/${currentUrl}`;
    }

    if (wallet === 'metamask') {
      // MetaMask uses metamask:// protocol or universal link
      // https://docs.metamask.io/wallet/how-to/connect/set-up-sdk/javascript/react/
      return `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
    }

    return '';
  }, []);

  // Open wallet app on mobile
  const openMobileWallet = useCallback((wallet: 'phantom' | 'solflare' | 'metamask') => {
    const deepLink = buildDeepLink(wallet);
    if (deepLink) {
      window.location.href = deepLink;
    }
  }, [buildDeepLink]);

  return {
    isMobile,
    isInWalletBrowser,
    openMobileWallet,
    buildDeepLink,
  };
}
