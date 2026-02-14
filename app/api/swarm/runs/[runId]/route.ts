import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type Ctx = {
  params: { runId: string } | Promise<{ runId: string }>;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  if (!prisma) {
    return NextResponse.json({ error: 'Persistence is not configured' }, { status: 501 });
  }

  const { runId } = await Promise.resolve(ctx.params);
  if (!isNonEmptyString(runId)) return NextResponse.json({ error: 'runId is required' }, { status: 400 });

  try {
    const run = await prisma.swarmRun.findUnique({
      where: { id: runId },
      include: { events: { orderBy: { at: 'asc' } } },
    });

    if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ run });
  } catch {
    return NextResponse.json({ error: 'Failed to load run' }, { status: 500 });
  }
}

