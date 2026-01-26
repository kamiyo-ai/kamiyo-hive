import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { prisma } from '@/lib/prisma';

function generateRefCode(wallet: string): string {
  const base = wallet.slice(0, 4) + wallet.slice(-4);
  let hash = 0;
  for (let i = 0; i < wallet.length; i++) {
    hash = ((hash << 5) - hash) + wallet.charCodeAt(i);
    hash = hash & hash;
  }
  return base + Math.abs(hash).toString(36).slice(0, 4).toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, score, signature, message, referredBy } = body;

    if (!wallet || score === undefined || !signature || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (score < 0 || score > 5) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    if (score < 5) {
      return NextResponse.json({ error: 'Score too low to qualify. Need 5/5.' }, { status: 400 });
    }

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

    const existing = await prisma.trialsCompletion.findUnique({
      where: { wallet },
    });

    if (existing) {
      return NextResponse.json({
        message: 'Already completed',
        score: existing.score,
        completedAt: existing.completedAt.getTime(),
        refCode: existing.refCode,
        shared: existing.shared,
        referralCount: existing.referralCount,
        entries: existing.shared ? Math.min(1 + existing.referralCount, 11) : 0,
      });
    }

    const refCode = generateRefCode(wallet);

    // Store referredBy but don't increment referrer's count yet
    // Referral only counts when this user shares on X (in PUT handler)
    let validReferrer: string | null = null;
    if (referredBy && referredBy !== refCode) {
      const referrer = await prisma.trialsCompletion.findUnique({
        where: { refCode: referredBy },
      });
      if (referrer && referrer.wallet !== wallet && referrer.shared) {
        validReferrer = referredBy;
      }
    }

    const completion = await prisma.trialsCompletion.create({
      data: {
        wallet,
        score,
        signature,
        refCode,
        referredBy: validReferrer,
      },
    });

    return NextResponse.json({
      success: true,
      score,
      completedAt: completion.completedAt.getTime(),
      refCode,
      shared: false,
      referralCount: 0,
      entries: 0,
    });
  } catch (error) {
    console.error('Trials completion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, signature, message } = body;

    if (!wallet || !signature || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const completion = await prisma.trialsCompletion.findUnique({
      where: { wallet },
    });

    if (!completion) {
      return NextResponse.json({ error: 'No completion found' }, { status: 404 });
    }

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

    // If already shared, just return current state
    if (completion.shared) {
      return NextResponse.json({
        success: true,
        refCode: completion.refCode,
        referralCount: completion.referralCount,
        entries: Math.min(1 + completion.referralCount, 11),
      });
    }

    // Mark as shared and increment referrer's count if applicable
    const updated = await prisma.trialsCompletion.update({
      where: { wallet },
      data: { shared: true },
    });

    // Now that user has shared, credit the referrer
    if (updated.referredBy) {
      await prisma.trialsCompletion.update({
        where: { refCode: updated.referredBy },
        data: { referralCount: { increment: 1 } },
      });
    }

    return NextResponse.json({
      success: true,
      refCode: updated.refCode,
      referralCount: updated.referralCount,
      entries: Math.min(1 + updated.referralCount, 11),
    });
  } catch (error) {
    console.error('Mark shared error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (wallet) {
    const completion = await prisma.trialsCompletion.findUnique({
      where: { wallet },
    });

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

  const completions = await prisma.trialsCompletion.findMany({
    where: { shared: true },
    orderBy: [
      { referralCount: 'desc' },
      { completedAt: 'asc' },
    ],
  });

  const failedAttempts = await prisma.trialsAttempt.findMany({
    where: { completed: true, passed: false },
    orderBy: { updatedAt: 'desc' },
  });

  const successEntries = completions.map((entry) => ({
    wallet: `${entry.wallet.slice(0, 4)}...${entry.wallet.slice(-4)}`,
    score: entry.score,
    completedAt: entry.completedAt.getTime(),
    referralCount: entry.referralCount,
    entries: Math.min(1 + entry.referralCount, 11),
    failed: false,
  }));

  const failedEntries = failedAttempts.map((entry) => ({
    wallet: `${entry.wallet.slice(0, 4)}...${entry.wallet.slice(-4)}`,
    score: entry.score ?? 0,
    completedAt: entry.updatedAt.getTime(),
    referralCount: 0,
    entries: 0,
    failed: true,
  }));

  const entries = [...successEntries, ...failedEntries];

  return NextResponse.json({ entries, total: entries.length });
}
