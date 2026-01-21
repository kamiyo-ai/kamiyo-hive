import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// Generate short referral code from wallet
function generateRefCode(wallet: string): string {
  // Use first 4 + last 4 chars of wallet as base, then hash for uniqueness
  const base = wallet.slice(0, 4) + wallet.slice(-4);
  let hash = 0;
  for (let i = 0; i < wallet.length; i++) {
    hash = ((hash << 5) - hash) + wallet.charCodeAt(i);
    hash = hash & hash;
  }
  return base + Math.abs(hash).toString(36).slice(0, 4).toUpperCase();
}

interface Completion {
  wallet: string;
  score: number;
  completedAt: number;
  signature: string;
  refCode: string;
  referredBy: string | null;
  referralCount: number;
  shared: boolean;
}

// In-memory storage - replace with database for production
const completions = new Map<string, Completion>();
const refCodeToWallet = new Map<string, string>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, score, signature, message, referredBy } = body;

    // Validate inputs
    if (!wallet || score === undefined || !signature || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (score < 0 || score > 5) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    // Must get 5/5 to qualify
    if (score < 5) {
      return NextResponse.json({ error: 'Score too low to qualify. Need 5/5.' }, { status: 400 });
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
      return NextResponse.json({
        message: 'Already completed',
        score: existing.score,
        completedAt: existing.completedAt,
        refCode: existing.refCode,
        shared: existing.shared,
        referralCount: existing.referralCount,
        entries: existing.shared ? Math.min(1 + existing.referralCount, 11) : 0,
      });
    }

    // Generate referral code
    const refCode = generateRefCode(wallet);
    refCodeToWallet.set(refCode, wallet);

    // Validate referral (can't refer yourself, referrer must exist and have shared)
    let validReferrer: string | null = null;
    if (referredBy && referredBy !== refCode) {
      const referrerWallet = refCodeToWallet.get(referredBy);
      if (referrerWallet && referrerWallet !== wallet) {
        const referrer = completions.get(referrerWallet);
        if (referrer && referrer.shared) {
          validReferrer = referredBy;
          // Increment referrer's count
          referrer.referralCount++;
        }
      }
    }

    // Store completion
    const completion: Completion = {
      wallet,
      score,
      completedAt: Date.now(),
      signature,
      refCode,
      referredBy: validReferrer,
      referralCount: 0,
      shared: false,
    };
    completions.set(wallet, completion);

    return NextResponse.json({
      success: true,
      score,
      completedAt: completion.completedAt,
      refCode,
      shared: false,
      referralCount: 0,
      entries: 0, // 0 until shared
    });
  } catch (error) {
    console.error('Trials completion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // Mark as shared
  try {
    const body = await request.json();
    const { wallet, signature, message } = body;

    if (!wallet || !signature || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const completion = completions.get(wallet);
    if (!completion) {
      return NextResponse.json({ error: 'No completion found' }, { status: 404 });
    }

    // Verify signature
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(wallet);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = pubkey.toBytes();

    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    completion.shared = true;

    return NextResponse.json({
      success: true,
      refCode: completion.refCode,
      referralCount: completion.referralCount,
      entries: Math.min(1 + completion.referralCount, 11),
    });
  } catch (error) {
    console.error('Mark shared error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  // If wallet provided, return their status
  if (wallet) {
    const completion = completions.get(wallet);
    if (!completion) {
      return NextResponse.json({ completed: false });
    }
    return NextResponse.json({
      completed: true,
      score: completion.score,
      refCode: completion.refCode,
      shared: completion.shared,
      referralCount: completion.referralCount,
      entries: completion.shared ? Math.min(1 + completion.referralCount, 11) : 0,
    });
  }

  // Return leaderboard data
  const entries = Array.from(completions.values())
    .filter(c => c.shared) // Only show those who shared
    .sort((a, b) => {
      // Sort by entries (referrals), then by completion time
      const aEntries = Math.min(1 + a.referralCount, 11);
      const bEntries = Math.min(1 + b.referralCount, 11);
      if (bEntries !== aEntries) return bEntries - aEntries;
      return a.completedAt - b.completedAt;
    })
    .map((entry) => ({
      wallet: `${entry.wallet.slice(0, 4)}...${entry.wallet.slice(-4)}`,
      score: entry.score,
      completedAt: entry.completedAt,
      referralCount: entry.referralCount,
      entries: Math.min(1 + entry.referralCount, 11),
    }));

  return NextResponse.json({ entries, total: entries.length });
}
