import { NextRequest, NextResponse } from 'next/server';
import { invokeJson } from '@/lib/swarm-llm.server';
import type { SwarmSynthesisInput, SwarmSynthesisResponse } from '@/types/swarm';

type Body = Partial<SwarmSynthesisInput> & { mission?: unknown; outputs?: unknown; synthesisPrompt?: unknown };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const mission = isNonEmptyString(body.mission) ? body.mission.trim() : '';
  const outputsRaw = Array.isArray(body.outputs) ? body.outputs : [];
  const synthesisPrompt = isNonEmptyString(body.synthesisPrompt) ? body.synthesisPrompt.trim() : '';

  if (mission.length < 8) {
    return NextResponse.json({ error: 'Mission is required' }, { status: 400 });
  }

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

  if (outputs.length === 0) {
    return NextResponse.json(
      { final: 'No outputs to synthesize.' } satisfies SwarmSynthesisResponse,
      { status: 200 }
    );
  }

  const system =
    'You are a synthesizer for a multi-agent swarm. Output STRICT JSON only. No markdown, no prose outside JSON.';
  const prompt = [
    'Return JSON of the form:',
    '{',
    '  "final": "...",',
    '  "summary": "...",',
    '  "followups": ["...", "..."]',
    '}',
    '',
    'Mission:',
    mission,
    synthesisPrompt ? '' : null,
    synthesisPrompt ? 'Extra guidance:' : null,
    synthesisPrompt ? synthesisPrompt : null,
    '',
    'Agent outputs:',
    JSON.stringify(outputs, null, 2),
    '',
    'Rules:',
    '- The "final" must be the best possible final deliverable for the mission.',
    '- Keep it concise but complete.',
    '- If there are contradictions across outputs, resolve them or note the uncertainty.',
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n');

  try {
    const llm = await invokeJson<SwarmSynthesisResponse>({ system, prompt, maxTokens: 1400, temperature: 0.2 });
    const value = llm?.value;
    if (value && typeof value.final === 'string' && value.final.trim()) {
      return NextResponse.json({ ...value, provider: llm.provider });
    }
  } catch {
    // Fall back.
  }

  const joined = outputs
    .map((o) => {
      const title = o.title ? `(${o.title})` : '';
      return `## ${o.agentId} ${title}\n\n${o.result}\n`;
    })
    .join('\n');

  return NextResponse.json({
    final: `Mission:\n${mission}\n\n${joined}`.trim(),
    provider: 'heuristic',
  });
}
