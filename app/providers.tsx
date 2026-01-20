'use client';

import { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { SolanaWalletProvider } from '@/context/WalletContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SolanaWalletProvider>
        {children}
      </SolanaWalletProvider>
    </SessionProvider>
  );
}
