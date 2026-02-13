'use client';

import { FC, ReactNode, useMemo, useCallback, useState } from 'react';
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

const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

interface Props {
  children: ReactNode;
}

export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() || DEFAULT_RPC;
  const [testWalletSecret] = useState<string | null>(() => getTestWalletSecret());

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
        // No-op: leaving room for a future UI toast without spamming production console.
      }
    }
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
