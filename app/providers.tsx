'use client';

import { ReactNode } from 'react';
import { SolanaWalletProvider } from '@/context/WalletContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SolanaWalletProvider>
      {children}
    </SolanaWalletProvider>
  );
}
