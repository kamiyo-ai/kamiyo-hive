import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// In-memory storage for now - replace with database or on-chain
const completions = new Map<string, {
  wallet: string;
  score: number;
  completedAt: number;
  signature: string;
}>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, score, signature, message } = body;

    // Validate inputs
    if (!wallet || score === undefined || !signature || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (score < 0 || score > 5) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    if (score < 3) {
      return NextResponse.json({ error: 'Score too low to qualify' }, { status: 400 });
    }

    // Verify wallet is valid
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(wallet);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Verify signature
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = pubkey.toBytes();

    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Check if already completed
    if (completions.has(wallet)) {
      const existing = completions.get(wallet)!;
      // Allow updating if new score is higher
      if (score <= existing.score) {
        return NextResponse.json({
          message: 'Already completed',
          score: existing.score,
          completedAt: existing.completedAt,
        });
      }
    }

    // Store completion
    completions.set(wallet, {
      wallet,
      score,
      completedAt: Date.now(),
      signature,
    });

    return NextResponse.json({
      success: true,
      score,
      completedAt: Date.now(),
    });
  } catch (error) {
    console.error('Trials completion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  // Return leaderboard data
  const entries = Array.from(completions.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.completedAt - b.completedAt;
    })
    .map((entry) => ({
      wallet: `${entry.wallet.slice(0, 4)}...${entry.wallet.slice(-4)}`,
      score: entry.score,
      completedAt: entry.completedAt,
    }));

  return NextResponse.json({ entries, total: entries.length });
}
