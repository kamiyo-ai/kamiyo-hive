import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { SwarmCritiqueResponse, SwarmPattern, SwarmPlanResponse, SwarmSynthesisResponse } from '@/types/swarm';

export const runtime = 'nodejs';

type TraceEvent = {
  at: number;
  kind: string;
  message: string;
  stepId?: string;
};

type Body = {
  teamId?: unknown;
  mission?: unknown;
  pattern?: unknown;
  maxSteps?: unknown;
  maxBudgetPerStep?: unknown;
  plan?: unknown;
  outputs?: unknown;
  final?: unknown;
  critique?: unknown;
  trace?: unknown;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function isPattern(v: unknown): v is SwarmPattern {
  return v === 'pipeline' || v === 'debate' || v === 'red_team';
}

function sanitizeTrace(v: unknown): TraceEvent[] {
  if (!Array.isArray(v)) return [];
  const out: TraceEvent[] = [];

  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    const at = typeof e.at === 'number' && Number.isFinite(e.at) ? e.at : null;
    const kind = isNonEmptyString(e.kind) ? e.kind.trim() : '';
    const message = isNonEmptyString(e.message) ? e.message.trim() : '';
    const stepId = isNonEmptyString(e.stepId) ? e.stepId.trim() : undefined;

    if (!at || !kind || !message) continue;
    out.push({ at, kind, message, stepId });
    if (out.length >= 250) break;
  }

  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

export async function POST(request: NextRequest) {
  if (!prisma) {
    return NextResponse.json({ error: 'Persistence is not configured' }, { status: 501 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const teamId = isNonEmptyString(body.teamId) ? body.teamId.trim() : '';
  const mission = isNonEmptyString(body.mission) ? body.mission.trim() : '';
  if (!teamId) return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
  if (mission.length < 8) return NextResponse.json({ error: 'Mission is required' }, { status: 400 });
  if (!isPattern(body.pattern)) return NextResponse.json({ error: 'Invalid pattern' }, { status: 400 });

  const maxStepsRaw = typeof body.maxSteps === 'number' && Number.isFinite(body.maxSteps) ? body.maxSteps : 6;
  const maxSteps = clampInt(maxStepsRaw, 1, 12);

  const maxBudgetPerStep =
    typeof body.maxBudgetPerStep === 'number' &&
    Number.isFinite(body.maxBudgetPerStep) &&
    body.maxBudgetPerStep > 0
      ? body.maxBudgetPerStep
      : null;

  const plan = isObject(body.plan) ? (body.plan as SwarmPlanResponse) : null;
  const outputs = Array.isArray(body.outputs) ? body.outputs : null;
  const final = isObject(body.final) ? (body.final as SwarmSynthesisResponse) : null;
  const critique = isObject(body.critique) ? (body.critique as SwarmCritiqueResponse) : null;

  if (!plan || !Array.isArray((plan as SwarmPlanResponse).steps)) {
    return NextResponse.json({ error: 'plan is required' }, { status: 400 });
  }
  if (!outputs) return NextResponse.json({ error: 'outputs is required' }, { status: 400 });
  if (!final || !isNonEmptyString(final.final)) return NextResponse.json({ error: 'final is required' }, { status: 400 });

  const trace = sanitizeTrace(body.trace);

  try {
    const run = await prisma.swarmRun.create({
      data: {
        teamId,
        mission,
        pattern: body.pattern,
        maxSteps,
        maxBudgetPerStep,
        status: 'completed',
        critiqueOk: critique?.ok ?? null,
        critiqueScore: typeof critique?.score === 'number' && Number.isFinite(critique.score) ? Math.round(critique.score) : null,
        plan,
        outputs,
        final,
        critique: critique ?? undefined,
        updatedAt: new Date(),
      },
      select: { id: true },
    });

    if (trace.length > 0) {
      await prisma.swarmEvent.createMany({
        data: trace.map((e) => ({
          runId: run.id,
          kind: e.kind,
          message: e.message,
          stepId: e.stepId ?? null,
          at: new Date(e.at),
        })),
      });
    }

    return NextResponse.json({ runId: run.id });
  } catch {
    return NextResponse.json({ error: 'Failed to persist run' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!prisma) {
    return NextResponse.json({ error: 'Persistence is not configured' }, { status: 501 });
  }

  const url = new URL(request.url);
  const teamId = url.searchParams.get('teamId')?.trim() ?? '';

  try {
    const runs = await prisma.swarmRun.findMany({
      where: teamId ? { teamId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        teamId: true,
        mission: true,
        pattern: true,
        maxSteps: true,
        maxBudgetPerStep: true,
        status: true,
        critiqueOk: true,
        critiqueScore: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ runs });
  } catch {
    return NextResponse.json({ error: 'Failed to list runs' }, { status: 500 });
  }
}
