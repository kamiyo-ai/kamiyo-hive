import { NextRequest, NextResponse } from 'next/server';
import { invokeJson } from '@/lib/swarm-llm.server';
import type { SwarmMemberInput, SwarmPattern, SwarmPlanResponse, SwarmPlanStep } from '@/types/swarm';

type PlanBody = {
  mission?: unknown;
  pattern?: unknown;
  members?: unknown;
  maxSteps?: unknown;
  maxBudgetPerStep?: unknown;
};

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function isPattern(v: unknown): v is SwarmPattern {
  return v === 'pipeline' || v === 'debate' || v === 'red_team';
}

function pickMember(
  members: SwarmMemberInput[],
  opts: { agentIdIncludes?: string[]; roleEquals?: string[] }
): SwarmMemberInput | null {
  const includes = (opts.agentIdIncludes ?? []).map((s) => s.toLowerCase());
  const roles = new Set((opts.roleEquals ?? []).map((s) => s.toLowerCase()));

  for (const m of members) {
    const agentId = m.agentId.toLowerCase();
    const role = m.role.toLowerCase();
    if (includes.some((s) => agentId.includes(s))) return m;
    if (roles.size && roles.has(role)) return m;
  }
  return null;
}

function mkStep(i: number, member: SwarmMemberInput, title: string, instruction: string): SwarmPlanStep {
  return {
    id: `s${i}`,
    title,
    memberId: member.memberId,
    agentId: member.agentId,
    instruction,
  };
}

function heuristicPlan(mission: string, pattern: SwarmPattern, members: SwarmMemberInput[], maxSteps: number): SwarmPlanResponse {
  const m0 = members[0] ?? null;
  if (!m0) return { steps: [] };
  if (members.length === 1) {
    return {
      steps: [
        mkStep(
          1,
          m0,
          'Complete mission',
          `Complete this mission end-to-end. Be explicit, concise, and output the final deliverable.\n\nMission:\n${mission}`
        ),
      ],
    };
  }

  const writer = pickMember(members, { agentIdIncludes: ['writer', 'scraper', 'analyst', 'monitor'] }) ?? members[0];
  const editor = pickMember(members, { agentIdIncludes: ['editor', 'review', 'judge', 'critic'] }) ?? members[1] ?? members[0];
  const publisher =
    pickMember(members, { agentIdIncludes: ['publisher', 'deployer'], roleEquals: ['admin'] }) ??
    members[2] ??
    members[members.length - 1]!;

  const steps: SwarmPlanStep[] = [];

  if (pattern === 'pipeline') {
    steps.push(
      mkStep(1, writer, 'Draft', `Draft a strong first pass for the mission. Output only the draft.\n\nMission:\n${mission}`)
    );
    steps.push(
      mkStep(2, editor, 'Review', `Review the draft for correctness and clarity. List concrete fixes and improvements.\n\nMission:\n${mission}`)
    );
    steps.push(
      mkStep(3, publisher, 'Finalize', `Produce the final output, applying the review feedback.\n\nMission:\n${mission}`)
    );
  } else if (pattern === 'debate') {
    const a = members[0]!;
    const b = members[1]!;
    const judge = members[2] ?? publisher;
    steps.push(
      mkStep(1, a, 'Proposal A', `Propose a solution. Be opinionated and specific.\n\nMission:\n${mission}`)
    );
    steps.push(
      mkStep(2, b, 'Proposal B', `Propose an alternative solution. Different angle than Proposal A.\n\nMission:\n${mission}`)
    );
    steps.push(
      mkStep(
        3,
        judge,
        'Judge',
        `Compare Proposal A vs Proposal B. Choose the best pieces of each and explain why.\n\nMission:\n${mission}`
      )
    );
    steps.push(
      mkStep(4, judge, 'Final', `Write the final combined output.\n\nMission:\n${mission}`)
    );
  } else {
    // red_team
    const red = members[1] ?? editor;
    steps.push(
      mkStep(1, writer, 'Draft', `Draft a complete solution.\n\nMission:\n${mission}`)
    );
    steps.push(
      mkStep(
        2,
        red,
        'Red team',
        `Attack the draft: find flaws, missing steps, risky assumptions, and edge cases. Be tough.\n\nMission:\n${mission}`
      )
    );
    steps.push(
      mkStep(3, writer, 'Patch', `Revise the draft to address every red-team point.\n\nMission:\n${mission}`)
    );
    steps.push(
      mkStep(4, publisher, 'Finalize', `Produce the final polished output.\n\nMission:\n${mission}`)
    );
  }

  return { steps: steps.slice(0, maxSteps) };
}

function sanitizeSteps(steps: SwarmPlanStep[], members: SwarmMemberInput[], maxSteps: number): SwarmPlanStep[] {
  const memberById = new Map(members.map((m) => [m.memberId, m]));
  const out: SwarmPlanStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!s || typeof s !== 'object') continue;
    if (typeof s.memberId !== 'string' || !memberById.has(s.memberId)) continue;

    const member = memberById.get(s.memberId)!;
    const title = typeof s.title === 'string' && s.title.trim() ? s.title.trim() : `Step ${i + 1}`;
    const instruction = typeof s.instruction === 'string' && s.instruction.trim() ? s.instruction.trim() : '';
    if (!instruction) continue;

    out.push({
      id: typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `s${i + 1}`,
      title,
      memberId: member.memberId,
      agentId: member.agentId,
      instruction,
      budget: typeof s.budget === 'number' && Number.isFinite(s.budget) && s.budget > 0 ? s.budget : undefined,
    });

    if (out.length >= maxSteps) break;
  }

  return out;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as PlanBody | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const mission = typeof body.mission === 'string' ? body.mission.trim() : '';
  if (mission.length < 8) {
    return NextResponse.json({ error: 'Mission is required' }, { status: 400 });
  }

  if (!isPattern(body.pattern)) {
    return NextResponse.json({ error: 'Invalid pattern' }, { status: 400 });
  }

  const rawMembers = Array.isArray(body.members) ? body.members : [];
  const members: SwarmMemberInput[] = rawMembers
    .map((m) => {
      if (!m || typeof m !== 'object') return null;
      const mm = m as Record<string, unknown>;
      const memberId = typeof mm.memberId === 'string' ? mm.memberId : '';
      const agentId = typeof mm.agentId === 'string' ? mm.agentId : '';
      const role = typeof mm.role === 'string' ? mm.role : 'member';
      const drawLimit = typeof mm.drawLimit === 'number' && Number.isFinite(mm.drawLimit) ? mm.drawLimit : 0;
      if (!memberId || !agentId) return null;
      return { memberId, agentId, role, drawLimit } satisfies SwarmMemberInput;
    })
    .filter((m): m is SwarmMemberInput => Boolean(m));

  if (members.length === 0) {
    return NextResponse.json({ error: 'At least one member is required' }, { status: 400 });
  }

  const maxStepsRaw = typeof body.maxSteps === 'number' ? body.maxSteps : 6;
  const maxSteps = clampInt(maxStepsRaw, 1, 12);

  const maxBudgetPerStep =
    typeof body.maxBudgetPerStep === 'number' && Number.isFinite(body.maxBudgetPerStep) && body.maxBudgetPerStep > 0
      ? body.maxBudgetPerStep
      : null;

  const pattern = body.pattern;

  const system =
    'You are a swarm planner for a multi-agent system. Output STRICT JSON only. No markdown, no prose outside JSON.';
  const prompt = [
    'Return JSON of the form:',
    '{',
    '  "steps": [',
    '    { "id": "s1", "title": "Draft", "memberId": "<memberId>", "instruction": "..." , "budget": 12.34 },',
    '    ...',
    '  ],',
    '  "synthesisPrompt": "..."',
    '}',
    '',
    `Mission: ${mission}`,
    `Pattern: ${pattern}`,
    `Max steps: ${maxSteps}`,
    maxBudgetPerStep ? `Max budget per step: ${maxBudgetPerStep}` : 'Max budget per step: (none)',
    '',
    'Members (choose only from these memberIds):',
    JSON.stringify(members, null, 2),
    '',
    'Rules:',
    '- Keep steps short and actionable.',
    '- Use the collaboration pattern.',
    '- If you include "budget", keep it > 0 and within Max budget per step if set.',
    '- Prefer routing review/critique steps to editors/admins when available.',
  ].join('\n');

  try {
    const llm = await invokeJson<SwarmPlanResponse>({ system, prompt, maxTokens: 1200, temperature: 0.2 });
    if (llm?.value?.steps && Array.isArray(llm.value.steps)) {
      const steps = sanitizeSteps(llm.value.steps as SwarmPlanStep[], members, maxSteps);
      if (steps.length > 0) {
        return NextResponse.json({
          steps,
          synthesisPrompt: llm.value.synthesisPrompt,
          provider: llm.provider,
        });
      }
    }
  } catch {
    // Fall through to heuristic plan.
  }

  const plan = heuristicPlan(mission, pattern, members, maxSteps);
  return NextResponse.json({ ...plan, provider: 'heuristic' });
}
