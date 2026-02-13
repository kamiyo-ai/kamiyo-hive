import { Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import {
  BaseMessageSignerWalletAdapter,
  WalletName,
  WalletReadyState,
} from '@solana/wallet-adapter-base';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

/**
 * Test wallet adapter for E2E testing with Playwright.
 * Auto-signs all transactions without user interaction.
 *
 * Usage: Add ?testWallet=<base58-secret-key> to URL
 */
export class TestWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = 'Test Wallet' as WalletName<'Test Wallet'>;
  url = 'https://kamiyo.ai';
  icon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iIzAwRjBGRiIvPjx0ZXh0IHg9IjE2IiB5PSIyMSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzAwMCIgZm9udC1zaXplPSIxNCI+VDwvdGV4dD48L3N2Zz4=';
  supportedTransactionVersions = new Set(['legacy', 0] as const);

  private _keypair: Keypair | null = null;
  private _publicKey: PublicKey | null = null;
  private _connecting = false;
  private _connected = false;

  constructor(secretKey?: string) {
    super();
    if (secretKey) {
      try {
        const decoded = bs58.decode(secretKey);
        this._keypair = Keypair.fromSecretKey(decoded);
        this._publicKey = this._keypair.publicKey;
      } catch (e) {
        console.error('Invalid test wallet secret key:', e);
      }
    }
  }

  get publicKey(): PublicKey | null {
    return this._publicKey;
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get connected(): boolean {
    return this._connected;
  }

  get readyState(): WalletReadyState {
    return this._keypair ? WalletReadyState.Installed : WalletReadyState.NotDetected;
  }

  async connect(): Promise<void> {
    if (this._connected || this._connecting) return;
    if (!this._keypair) throw new Error('Test wallet not configured');

    this._connecting = true;
    try {
      this._connected = true;
      this.emit('connect', this._publicKey!);
    } finally {
      this._connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    this.emit('disconnect');
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    if (!this._keypair) throw new Error('Test wallet not connected');

    if (transaction instanceof Transaction) {
      transaction.sign(this._keypair);
    } else {
      // VersionedTransaction
      transaction.sign([this._keypair]);
    }
    return transaction;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
    return Promise.all(transactions.map((tx) => this.signTransaction(tx)));
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this._keypair) throw new Error('Test wallet not connected');
    return nacl.sign.detached(message, this._keypair.secretKey);
  }
}

/**
 * Get test wallet secret from URL param
 */
export function getTestWalletSecret(): string | null {
  if (process.env.NODE_ENV === 'production') return null;
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('testWallet');
}

/**
 * Check if we're in test mode
 */
export function isTestMode(): boolean {
  return !!getTestWalletSecret();
}
