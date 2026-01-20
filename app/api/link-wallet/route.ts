import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const API_URL = process.env.KAMIYO_API_URL || 'https://api.kamiyo.ai';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.twitterId) {
      return NextResponse.json(
        { error: 'Not authenticated with X' },
        { status: 401 }
      );
    }

    const { walletAddress, signature, message } = await request.json();

    if (!walletAddress || !signature || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify the signature
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Forward to kamiyo-x-bot API to store the link
    const response = await fetch(`${API_URL}/api/link-wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_SECRET}`,
      },
      body: JSON.stringify({
        twitterId: session.user.twitterId,
        twitterUsername: session.user.twitterUsername,
        walletAddress,
        signature,
        message,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to link wallet:', error);
      return NextResponse.json(
        { error: 'Failed to link wallet' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Link wallet error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
