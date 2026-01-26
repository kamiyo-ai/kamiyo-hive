import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// One-time fix for referral counts
// DELETE this endpoint after running
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const completions = await prisma.trialsCompletion.findMany();

    // Build correct counts: only count referrals where referred user has shared
    const correctCounts: Record<string, number> = {};

    for (const completion of completions) {
      if (completion.referredBy && completion.shared) {
        correctCounts[completion.referredBy] = (correctCounts[completion.referredBy] || 0) + 1;
      }
    }

    // Update each completion with the correct count
    const updates: { wallet: string; old: number; new: number }[] = [];

    for (const completion of completions) {
      const correctCount = correctCounts[completion.refCode] || 0;

      if (completion.referralCount !== correctCount) {
        await prisma.trialsCompletion.update({
          where: { wallet: completion.wallet },
          data: { referralCount: correctCount },
        });

        updates.push({
          wallet: `${completion.wallet.slice(0, 4)}...${completion.wallet.slice(-4)}`,
          old: completion.referralCount,
          new: correctCount,
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalRecords: completions.length,
      updatedRecords: updates.length,
      updates,
    });
  } catch (error) {
    console.error('Fix referrals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
