import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, signature, message } = body;

    if (!wallet || !signature || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    const existing = await prisma.trialsAttempt.findUnique({
      where: { wallet },
    });

    if (existing) {
      return NextResponse.json({
        error: 'Attempt already used',
        attemptUsed: true,
        startedAt: existing.startedAt.getTime(),
        completed: existing.completed,
        passed: existing.passed,
      }, { status: 403 });
    }

    await prisma.trialsAttempt.create({
      data: { wallet },
    });

    return NextResponse.json({
      success: true,
      message: 'Attempt registered. You have one chance.',
    });
  } catch (error) {
    console.error('Attempt registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, passed } = body;

    if (!wallet || passed === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const attempt = await prisma.trialsAttempt.findUnique({
      where: { wallet },
    });

    if (!attempt) {
      return NextResponse.json({ error: 'No attempt found' }, { status: 404 });
    }

    if (attempt.completed) {
      return NextResponse.json({ error: 'Attempt already completed' }, { status: 400 });
    }

    await prisma.trialsAttempt.update({
      where: { wallet },
      data: { completed: true, passed },
    });

    return NextResponse.json({
      success: true,
      passed,
    });
  } catch (error) {
    console.error('Attempt completion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet required' }, { status: 400 });
  }

  const attempt = await prisma.trialsAttempt.findUnique({
    where: { wallet },
  });

  if (!attempt) {
    return NextResponse.json({
      hasAttempt: false,
      canAttempt: true,
    });
  }

  return NextResponse.json({
    hasAttempt: true,
    canAttempt: false,
    startedAt: attempt.startedAt.getTime(),
    completed: attempt.completed,
    passed: attempt.passed,
  });
}
