import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const API_URL = process.env.KAMIYO_API_URL || 'https://api.kamiyo.ai';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.twitterId || !session.user.twitterUsername) {
    return NextResponse.json({ error: 'Not authenticated with X' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON');
  }

  if (!isRecord(body)) return badRequest('Invalid request body');

  const walletAddress = body.walletAddress;
  const signature = body.signature;
  const message = body.message;

  if (typeof walletAddress !== 'string' || typeof signature !== 'string' || typeof message !== 'string') {
    return badRequest('Missing required fields');
  }

  if (message.length > 4096) return badRequest('Message too long');

  if (!message.includes('KAMIYO Wallet Verification')) return badRequest('Invalid message');
  if (!message.includes(`Twitter: @${session.user.twitterUsername}`)) return badRequest('Invalid message');
  if (!message.includes(`Twitter ID: ${session.user.twitterId}`)) return badRequest('Invalid message');
  if (!message.includes(`Wallet: ${walletAddress}`)) return badRequest('Invalid message');

  const apiSecret = process.env.API_SECRET;
  if (!apiSecret) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 503 }
    );
  }

  let publicKey: PublicKey;
  let signatureBytes: Uint8Array;
  try {
    publicKey = new PublicKey(walletAddress);
  } catch {
    return badRequest('Invalid wallet address');
  }

  try {
    signatureBytes = bs58.decode(signature);
  } catch {
    return badRequest('Invalid signature encoding');
  }

  if (signatureBytes.length !== nacl.sign.signatureLength) {
    return badRequest('Invalid signature');
  }

  const messageBytes = new TextEncoder().encode(message);
  const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());

  if (!isValid) return badRequest('Invalid signature');

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/link-wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiSecret}`,
      },
      body: JSON.stringify({
        twitterId: session.user.twitterId,
        twitterUsername: session.user.twitterUsername,
        walletAddress,
        signature,
        message,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error('Failed to link wallet (upstream request failed):', error);
    return NextResponse.json({ error: 'Failed to link wallet' }, { status: 502 });
  }

  if (!response.ok) {
    const upstreamText = await response.text().catch(() => '');
    console.error('Failed to link wallet (upstream error):', response.status, upstreamText.slice(0, 500));
    return NextResponse.json({ error: 'Failed to link wallet' }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
