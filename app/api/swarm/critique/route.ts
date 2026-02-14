import { NextRequest, NextResponse } from 'next/server';
import { invokeJson } from '@/lib/swarm-llm.server';
import type { SwarmCritiqueResponse, SwarmMemberInput } from '@/types/swarm';

type Body = {
  mission?: unknown;
  final?: unknown;
  outputs?: unknown;
  members?: unknown;
  remainingSteps?: unknown;
  maxBudgetPerStep?: unknown;
};

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function pickMember(members: SwarmMemberInput[], prefer: Array<(m: SwarmMemberInput) => boolean>) {
  for (const pred of prefer) {
    const found = members.find(pred);
    if (found) return found;
  }
  return members[0] ?? null;
}

function sanitizeFixes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const fixes: string[] = [];
  for (const item of v) {
    if (!isNonEmptyString(item)) continue;
    fixes.push(item.trim());
    if (fixes.length >= 8) break;
  }
  return fixes;
}

function sanitizeResponse(
  raw: unknown,
  members: SwarmMemberInput[],
  remainingSteps: number,
  maxBudgetPerStep: number | null
): SwarmCritiqueResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const ok = typeof r.ok === 'boolean' ? r.ok : null;
  const scoreRaw = typeof r.score === 'number' && Number.isFinite(r.score) ? r.score : null;
  const fixes = sanitizeFixes(r.fixes);
  const shouldContinue = typeof r.shouldContinue === 'boolean' ? r.shouldContinue : null;

  if (ok === null || scoreRaw === null || shouldContinue === null) return null;

  const score = Math.round(Math.min(100, Math.max(0, scoreRaw)));

  const next = r.nextStep;
  if (!next || typeof next !== 'object') {
    return { ok, score, fixes, shouldContinue: ok ? false : shouldContinue };
  }

  if (ok || remainingSteps <= 0) {
    return { ok, score, fixes, shouldContinue: false };
  }

  const ns = next as Record<string, unknown>;
  const memberId = isNonEmptyString(ns.memberId) ? ns.memberId.trim() : '';
  if (!memberId || !members.some((m) => m.memberId === memberId)) {
    return { ok, score, fixes, shouldContinue };
  }

  const title = isNonEmptyString(ns.title) ? ns.title.trim() : 'Patch';
  const instruction = isNonEmptyString(ns.instruction) ? ns.instruction.trim() : '';
  if (!instruction) return { ok, score, fixes, shouldContinue };

  const budgetRaw = typeof ns.budget === 'number' && Number.isFinite(ns.budget) && ns.budget > 0 ? ns.budget : null;
  const budget = budgetRaw === null ? undefined : Math.max(0, Math.min(budgetRaw, maxBudgetPerStep ?? budgetRaw));

  return {
    ok,
    score,
    fixes,
    shouldContinue,
    nextStep: {
      title,
      memberId,
      instruction,
      budget: budget && budget > 0 ? budget : undefined,
    },
  };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const mission = isNonEmptyString(body.mission) ? body.mission.trim() : '';
  const final = isNonEmptyString(body.final) ? body.final.trim() : '';
  if (mission.length < 8) return NextResponse.json({ error: 'Mission is required' }, { status: 400 });
  if (final.length < 8) return NextResponse.json({ error: 'Final output is required' }, { status: 400 });

  const membersRaw = Array.isArray(body.members) ? body.members : [];
  const members: SwarmMemberInput[] = membersRaw
    .map((m) => {
      if (!m || typeof m !== 'object') return null;
      const mm = m as Record<string, unknown>;
      const memberId = isNonEmptyString(mm.memberId) ? mm.memberId.trim() : '';
      const agentId = isNonEmptyString(mm.agentId) ? mm.agentId.trim() : '';
      const role = isNonEmptyString(mm.role) ? mm.role.trim() : 'member';
      const drawLimit = typeof mm.drawLimit === 'number' && Number.isFinite(mm.drawLimit) ? mm.drawLimit : 0;
      if (!memberId || !agentId) return null;
      return { memberId, agentId, role, drawLimit } satisfies SwarmMemberInput;
    })
    .filter((m): m is SwarmMemberInput => Boolean(m));

  if (members.length === 0) {
    return NextResponse.json({ error: 'At least one member is required' }, { status: 400 });
  }

  const outputsRaw = Array.isArray(body.outputs) ? body.outputs : [];
  const outputs = outputsRaw
    .map((o) => {
      if (!o || typeof o !== 'object') return null;
      const oo = o as Record<string, unknown>;
      const stepId = isNonEmptyString(oo.stepId) ? oo.stepId.trim() : '';
      const title = isNonEmptyString(oo.title) ? oo.title.trim() : '';
      const agentId = isNonEmptyString(oo.agentId) ? oo.agentId.trim() : '';
      const result = isNonEmptyString(oo.result) ? oo.result.trim() : '';
      if (!stepId || !agentId || !result) return null;
      return { stepId, title, agentId, result };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const remainingSteps =
    typeof body.remainingSteps === 'number' && Number.isFinite(body.remainingSteps)
      ? clampInt(body.remainingSteps, 0, 12)
      : 0;

  const maxBudgetPerStep =
    typeof body.maxBudgetPerStep === 'number' &&
    Number.isFinite(body.maxBudgetPerStep) &&
    body.maxBudgetPerStep > 0
      ? body.maxBudgetPerStep
      : null;

  const system =
    'You are a strict evaluator for a multi-agent swarm. Output STRICT JSON only. No markdown, no prose outside JSON.';
  const prompt = [
    'Return JSON of the form:',
    '{',
    '  "ok": true,',
    '  "score": 0,',
    '  "fixes": ["..."],',
    '  "shouldContinue": false,',
    '  "nextStep": { "title": "Patch", "memberId": "<memberId>", "instruction": "...", "budget": 12.34 }',
    '}',
    '',
    `Mission: ${mission}`,
    '',
    'Final output to critique:',
    final,
    '',
    outputs.length ? 'Supporting step outputs (context):' : 'Supporting step outputs (context): (none)',
    outputs.length ? JSON.stringify(outputs, null, 2) : '',
    '',
    `Remaining steps available: ${remainingSteps}`,
    maxBudgetPerStep ? `Max budget per step: ${maxBudgetPerStep}` : 'Max budget per step: (none)',
    '',
    'Members (choose only from these memberIds):',
    JSON.stringify(members, null, 2),
    '',
    'Rules:',
    '- Score is 0-100. Be honest and specific.',
    '- If the final output fully satisfies the mission, set ok=true and shouldContinue=false.',
    '- fixes must be concrete and testable (max 6).',
    '- If ok=false AND Remaining steps available > 0, set shouldContinue=true and propose exactly one nextStep that addresses the fixes.',
    '- If Remaining steps available == 0, set shouldContinue=false and omit nextStep.',
    '- nextStep.memberId must be one of the provided memberIds.',
    '- If you include nextStep.budget, keep it > 0 and within Max budget per step if provided.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const llm = await invokeJson<SwarmCritiqueResponse>({ system, prompt, maxTokens: 1200, temperature: 0.2 });
    const value = sanitizeResponse(llm?.value, members, remainingSteps, maxBudgetPerStep);
    if (value) {
      return NextResponse.json({ ...value, provider: llm!.provider });
    }
  } catch {
    // Fall back.
  }

  const hasError = /(^|\n)\s*ERROR:|status:\s*failed/i.test(final);
  const score =
    hasError ? 10 : final.length < 220 ? 45 : final.length < 600 ? 65 : 78;
  const ok = !hasError && score >= 75;

  const fixes = ok
    ? []
    : [
        'Tighten the final output into a complete deliverable (remove filler, add missing steps).',
        'Resolve any uncertainties or state what assumptions you are making.',
      ];

  const shouldContinue = !ok && remainingSteps > 0;

  if (!shouldContinue) {
    return NextResponse.json({ ok, score, fixes, shouldContinue, provider: 'heuristic' });
  }

  const patcher =
    pickMember(members, [
      (m) => m.role.toLowerCase() === 'admin',
      (m) => m.agentId.toLowerCase().includes('editor'),
      (m) => m.agentId.toLowerCase().includes('critic'),
      (m) => m.agentId.toLowerCase().includes('writer'),
      () => true,
    ]) ?? members[0]!;

  return NextResponse.json({
    ok,
    score,
    fixes,
    shouldContinue,
    nextStep: {
      title: 'Patch',
      memberId: patcher.memberId,
      instruction: [
        'Improve the final output so it fully satisfies the mission.',
        '',
        'Fixes to apply:',
        ...fixes.map((f) => `- ${f}`),
        '',
        `Mission:\n${mission}`,
        '',
        'Current final:',
        final,
      ].join('\n'),
    },
    provider: 'heuristic',
  });
}

