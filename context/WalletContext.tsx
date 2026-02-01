'use client';

import { FC, ReactNode, useMemo, useCallback, useEffect, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WalletError, Adapter } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { TestWalletAdapter, getTestWalletSecret } from '@/lib/test-wallet';

import '@solana/wallet-adapter-react-ui/styles.css';

const MAINNET_RPC = 'https://mainnet.helius-rpc.com/?api-key=c4a9b21c-8650-451d-9572-8c8a3543a0be';

interface Props {
  children: ReactNode;
}

export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  const endpoint = MAINNET_RPC;
  const [testWalletSecret, setTestWalletSecret] = useState<string | null>(null);

  // Check for test wallet on mount (client-side only)
  useEffect(() => {
    const secret = getTestWalletSecret();
    if (secret) {
      console.log('[TestWallet] Test mode enabled');
      setTestWalletSecret(secret);
    }
  }, []);

  const wallets = useMemo(
    () => {
      const adapters: Adapter[] = [];

      // If test wallet is configured, use it exclusively
      if (testWalletSecret) {
        adapters.push(new TestWalletAdapter(testWalletSecret));
      } else {
        // Normal wallet adapters
        adapters.push(
          new PhantomWalletAdapter(),
          new SolflareWalletAdapter(),
          new CoinbaseWalletAdapter(),
          new LedgerWalletAdapter(),
        );
      }

      return adapters;
    },
    [testWalletSecret]
  );

  // Handle wallet connection errors - especially for mobile
  const onError = useCallback((error: WalletError) => {
    console.error('Wallet error:', error);

    // Check if we're on mobile and the wallet isn't installed
    if (typeof window !== 'undefined') {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      if (isMobile && error.name === 'WalletNotReadyError') {
        // The wallet adapter should handle deep linking automatically,
        // but if it fails, we can provide a fallback
        console.log('Mobile wallet not detected - adapter should redirect to app store');
      }
    }
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} onError={onError}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
