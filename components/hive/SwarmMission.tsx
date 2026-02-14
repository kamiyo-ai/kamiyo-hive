'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import PayButton from '@/components/PayButton';
import { Dropdown } from '@/components/ui/Dropdown';
import { submitTask } from '@/lib/hive-api';
import type { HiveMember, TaskResult } from '@/lib/hive-api';
import type {
  SwarmMemberInput,
  SwarmPattern,
  SwarmPlanResponse,
  SwarmPlanStep,
  SwarmCritiqueResponse,
  SwarmSynthesisResponse,
} from '@/types/swarm';

type TraceKind = 'plan' | 'step_started' | 'step_completed' | 'synthesis' | 'critique' | 'done' | 'error';

type TraceEvent = {
  id: string;
  at: number;
  kind: TraceKind;
  message: string;
  stepId?: string;
};

type SavedRun = {
  id: string;
  mission: string;
  pattern: string;
  status: string;
  critiqueOk: boolean | null;
  critiqueScore: number | null;
  createdAt: string;
};

const PATTERN_OPTIONS: Array<{ value: SwarmPattern; label: string }> = [
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'debate', label: 'Debate' },
  { value: 'red_team', label: 'Red Team' },
];

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtAmount(amount: number, currency: string) {
  if (!Number.isFinite(amount)) return '';
  const fixed = Math.abs(amount) >= 1000 ? amount.toFixed(2) : amount.toFixed(4);
  return `${fixed} ${currency}`;
}

function statusClass(status: string) {
  switch (status) {
    case 'completed':
      return 'text-[#00f0ff] border-[#00f0ff]/30';
    case 'processing':
      return 'text-yellow-400 border-yellow-400/30';
    case 'failed':
      return 'text-red-400 border-red-400/30';
    default:
      return 'text-gray-400 border-gray-500/30';
  }
}

function clampBudget(budget: number | undefined, maxBudget: number | null, drawLimit: number) {
  const b = typeof budget === 'number' && Number.isFinite(budget) && budget > 0 ? budget : null;
  const capped = b ?? (maxBudget ?? null);
  if (capped === null) return undefined;
  const safe = Math.max(0, Math.min(capped, drawLimit));
  return safe > 0 ? safe : undefined;
}

export function SwarmMission({
  teamId,
  members,
  currencyDisplay,
  onAfterStep,
}: {
  teamId: string;
  members: HiveMember[];
  currencyDisplay: string;
  onAfterStep?: () => void;
}) {
  const params = useParams();
  const localeParam = (params as Record<string, string | string[] | undefined>).locale;
  const locale = typeof localeParam === 'string' ? localeParam : Array.isArray(localeParam) ? localeParam[0] ?? 'en' : 'en';

  const memberInputs: SwarmMemberInput[] = useMemo(() => {
    return members.map((m) => ({
      memberId: m.id,
      agentId: m.agentId,
      role: m.role,
      drawLimit: m.drawLimit,
    }));
  }, [members]);

  const traceRef = useRef<TraceEvent[]>([]);

  const [mission, setMission] = useState('');
  const [pattern, setPattern] = useState<SwarmPattern>('pipeline');
  const [maxSteps, setMaxSteps] = useState('6');
  const [maxBudgetPerStep, setMaxBudgetPerStep] = useState('');
  const [autopilot, setAutopilot] = useState(true);

  const [planning, setPlanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [plan, setPlan] = useState<SwarmPlanResponse | null>(null);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [results, setResults] = useState<Record<string, TaskResult>>({});
  const [critique, setCritique] = useState<SwarmCritiqueResponse | null>(null);
  const [final, setFinal] = useState<SwarmSynthesisResponse | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [persistenceEnabled, setPersistenceEnabled] = useState<boolean | null>(null);
  const [recentRuns, setRecentRuns] = useState<SavedRun[]>([]);
  const [runsNonce, setRunsNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/swarm/runs?teamId=${encodeURIComponent(teamId)}`);
        if (res.status === 501) {
          if (!cancelled) setPersistenceEnabled(false);
          return;
        }
        const data = (await res.json().catch(() => null)) as { runs?: unknown } | null;
        const runsRaw = Array.isArray(data?.runs) ? (data!.runs as unknown[]) : [];
        const runs = runsRaw
          .map((r) => {
            if (!r || typeof r !== 'object') return null;
            const rr = r as Record<string, unknown>;
            const id = typeof rr.id === 'string' ? rr.id : '';
            const mission = typeof rr.mission === 'string' ? rr.mission : '';
            const pattern = typeof rr.pattern === 'string' ? rr.pattern : '';
            const status = typeof rr.status === 'string' ? rr.status : '';
            const createdAt = typeof rr.createdAt === 'string' ? rr.createdAt : '';
            if (!id || !mission || !pattern || !status || !createdAt) return null;
            const critiqueOk = typeof rr.critiqueOk === 'boolean' ? rr.critiqueOk : null;
            const critiqueScore = typeof rr.critiqueScore === 'number' && Number.isFinite(rr.critiqueScore) ? rr.critiqueScore : null;
            return { id, mission, pattern, status, createdAt, critiqueOk, critiqueScore } satisfies SavedRun;
          })
          .filter((x): x is SavedRun => Boolean(x));

        if (!cancelled) {
          setPersistenceEnabled(true);
          setRecentRuns(runs);
        }
      } catch {
        if (!cancelled) setPersistenceEnabled(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [teamId, runId, runsNonce]);

  const canPlan = mission.trim().length >= 8 && memberInputs.length > 0 && !planning && !running;
  const canRun = Boolean(plan?.steps?.length) && !planning && !running;

  const pushTrace = (evt: Omit<TraceEvent, 'id' | 'at'>) => {
    const event: TraceEvent = { ...evt, id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, at: Date.now() };
    traceRef.current.push(event);
    setTrace((prev) => [...prev, event]);
  };

  const reset = () => {
    setPlan(null);
    setTrace([]);
    traceRef.current = [];
    setResults({});
    setCritique(null);
    setFinal(null);
    setError('');
    setSaveError('');
    setRunId(null);
  };

  const planMission = async () => {
    if (!canPlan) return;
    setPlanning(true);
    setError('');
    setCritique(null);
    setFinal(null);
    setResults({});
    setTrace([]);
    traceRef.current = [];
    setSaveError('');
    setRunId(null);

    const maxStepsNum = Math.max(1, Math.min(12, parseInt(maxSteps || '6', 10) || 6));
    const maxBudgetNum =
      maxBudgetPerStep.trim() === '' ? null : Number.isFinite(Number(maxBudgetPerStep)) ? Number(maxBudgetPerStep) : null;

    try {
      const res = await fetch('/api/swarm/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mission: mission.trim(),
          pattern,
          members: memberInputs,
          maxSteps: maxStepsNum,
          maxBudgetPerStep: maxBudgetNum,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = typeof data?.error === 'string' ? data.error : 'Failed to plan mission';
        throw new Error(msg);
      }
      if (!data?.steps || !Array.isArray(data.steps) || data.steps.length === 0) {
        throw new Error('Planner returned an empty plan');
      }

      setPlan({ steps: data.steps as SwarmPlanStep[], synthesisPrompt: data.synthesisPrompt });
      pushTrace({ kind: 'plan', message: `Planned ${data.steps.length} steps (${pattern}).` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to plan mission');
    } finally {
      setPlanning(false);
    }
  };

  const runStep = async (step: SwarmPlanStep, maxBudgetNum: number | null, context?: string): Promise<TaskResult> => {
    const member = members.find((m) => m.id === step.memberId);
    if (!member) throw new Error(`Unknown member for step ${step.id}`);

    pushTrace({ kind: 'step_started', stepId: step.id, message: `${step.agentId}: ${step.title}` });

    const budget = clampBudget(step.budget, maxBudgetNum, member.drawLimit);
    const result = await submitTask(teamId, {
      memberId: step.memberId,
      description: context ? `${step.instruction}${context}` : step.instruction,
      budget,
    });

    setResults((prev) => ({ ...prev, [step.id]: result }));
    const spent =
      typeof result.amountDrawn === 'number' && Number.isFinite(result.amountDrawn)
        ? result.amountDrawn
        : null;
    pushTrace({
      kind: 'step_completed',
      stepId: step.id,
      message: [
        `${step.agentId}: ${result.status}`,
        spent !== null ? `spent ${fmtAmount(spent, currencyDisplay)}` : null,
        budget ? `cap ${fmtAmount(budget, currencyDisplay)}` : null,
      ]
        .filter((x): x is string => Boolean(x))
        .join(' · '),
    });

    try {
      onAfterStep?.();
    } catch {
      // Ignore UI refresh failures.
    }

    if (result.status === 'failed') {
      throw new Error(`${step.agentId} failed`);
    }

    if (budget && spent !== null && spent > budget + 1e-9) {
      throw new Error(
        `${step.agentId} breached budget cap (${fmtAmount(spent, currencyDisplay)} > ${fmtAmount(budget, currencyDisplay)})`
      );
    }

    return result;
  };

  const runMission = async () => {
    if (!canRun || !plan) return;
    setRunning(true);
    setError('');
    setCritique(null);
    setFinal(null);
    setResults({});
    setSaveError('');
    setRunId(null);

    const maxStepsNum = Math.max(1, Math.min(12, parseInt(maxSteps || '6', 10) || 6));
    const maxBudgetNum =
      maxBudgetPerStep.trim() === '' ? null : Number.isFinite(Number(maxBudgetPerStep)) ? Number(maxBudgetPerStep) : null;

    try {
      const steps = plan.steps.slice(0, maxStepsNum);
      const localResults: Record<string, TaskResult> = {};

      const buildContext = (prevSteps: SwarmPlanStep[]) => {
        const slice = prevSteps.slice(-3);
        const blocks = slice
          .map((s) => {
            const r = localResults[s.id];
            const text =
              r?.output?.result ||
              (r?.error ? `ERROR: ${r.error}` : '') ||
              (r ? `Status: ${r.status}` : '');
            if (!text) return null;
            const clipped = text.length > 1800 ? `${text.slice(0, 1800)}\n\n[truncated]` : text;
            const title = s.title ? ` (${s.title})` : '';
            return `### ${s.agentId}${title}\n${clipped}`;
          })
          .filter((b): b is string => Boolean(b))
          .join('\n\n');

        return blocks ? `\n\nContext from previous steps:\n${blocks}` : '';
      };

      if (pattern === 'debate' && steps.length >= 2) {
        const [r0, r1] = await Promise.all([runStep(steps[0], maxBudgetNum), runStep(steps[1], maxBudgetNum)]);
        localResults[steps[0].id] = r0;
        localResults[steps[1].id] = r1;
        for (let i = 2; i < steps.length; i++) {
          const context = buildContext(steps.slice(0, i));
          localResults[steps[i].id] = await runStep(steps[i], maxBudgetNum, context);
        }
      } else {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i]!;
          const context = buildContext(steps.slice(0, i));
          localResults[step.id] = await runStep(step, maxBudgetNum, context);
        }
      }

      const buildOutputs = (allSteps: SwarmPlanStep[]) => {
        return allSteps
          .map((s) => {
            const r = localResults[s.id];
            const text =
              r?.output?.result ||
              (r?.error ? `ERROR: ${r.error}` : '') ||
              (r ? `Status: ${r.status}` : '');
            return text
              ? {
                  stepId: s.id,
                  title: s.title,
                  agentId: s.agentId,
                  status: r?.status,
                  amountDrawn: r?.amountDrawn,
                  result: text,
                }
              : null;
          })
          .filter((x): x is NonNullable<typeof x> => Boolean(x));
      };

      const synthesize = async (outputs: ReturnType<typeof buildOutputs>) => {
        const res = await fetch('/api/swarm/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mission: mission.trim(), outputs, synthesisPrompt: plan.synthesisPrompt }),
        });
        const data = (await res.json().catch(() => null)) as SwarmSynthesisResponse | null;
        if (!res.ok || !data?.final) {
          throw new Error('Failed to synthesize output');
        }
        return data;
      };

      const runCritique = async (finalText: string, outputs: ReturnType<typeof buildOutputs>, remainingSteps: number) => {
        const res = await fetch('/api/swarm/critique', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mission: mission.trim(),
            final: finalText,
            outputs,
            members: memberInputs,
            remainingSteps,
            maxBudgetPerStep: maxBudgetNum,
          }),
        });
        const data = (await res.json().catch(() => null)) as (SwarmCritiqueResponse & { provider?: string }) | null;
        if (!res.ok || !data) {
          throw new Error('Critique failed');
        }
        return data;
      };

      pushTrace({ kind: 'synthesis', message: 'Synthesizing final output...' });
      let outputs = buildOutputs(steps);
      let currentFinal = await synthesize(outputs);
      setFinal(currentFinal);

      const maxLoops = autopilot ? 3 : 1;
      let lastCritique: SwarmCritiqueResponse | null = null;
      for (let i = 0; i < maxLoops; i++) {
        const remainingSteps = autopilot ? Math.max(0, maxStepsNum - steps.length) : 0;
        pushTrace({
          kind: 'critique',
          message: autopilot && remainingSteps > 0 ? 'Critiquing output (autopilot)...' : 'Critiquing output...',
        });

        const c = await runCritique(currentFinal.final, outputs, remainingSteps);
        lastCritique = c;
        setCritique(c);
        pushTrace({
          kind: 'critique',
          message: c.ok ? `Critique score ${c.score}/100 (ok).` : `Critique score ${c.score}/100 (needs work).`,
        });

        if (!autopilot) break;
        if (c.ok || !c.shouldContinue) break;
        const nextStep = c.nextStep;
        if (remainingSteps <= 0 || !nextStep) break;

        const member = members.find((m) => m.id === nextStep.memberId);
        if (!member) break;

        let patchId = `p${i + 1}`;
        while (steps.some((s) => s.id === patchId)) patchId = `${patchId}-${Math.random().toString(16).slice(2, 6)}`;

        const patchStep: SwarmPlanStep = {
          id: patchId,
          title: nextStep.title || 'Patch',
          memberId: member.id,
          agentId: member.agentId,
          instruction: nextStep.instruction,
          budget: nextStep.budget,
        };

        steps.push(patchStep);
        setPlan((prev) => (prev ? { ...prev, steps: [...prev.steps, patchStep] } : { steps: [patchStep] }));

        const context = buildContext(steps.slice(0, -1));
        localResults[patchStep.id] = await runStep(patchStep, maxBudgetNum, context);
        outputs = buildOutputs(steps);

        pushTrace({ kind: 'synthesis', message: 'Resynthesizing with patch...' });
        currentFinal = await synthesize(outputs);
        setFinal(currentFinal);
      }

      pushTrace({ kind: 'done', message: 'Done.' });

      setSaving(true);
      try {
        const res = await fetch('/api/swarm/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId,
            mission: mission.trim(),
            pattern,
            maxSteps: maxStepsNum,
            maxBudgetPerStep: maxBudgetNum,
            plan: { steps, synthesisPrompt: plan.synthesisPrompt },
            outputs,
            final: currentFinal,
            critique: lastCritique,
            trace: traceRef.current,
          }),
        });
        const data = (await res.json().catch(() => null)) as { runId?: unknown; error?: unknown } | null;
        const savedId = typeof data?.runId === 'string' ? data.runId.trim() : '';
        if (res.ok && savedId) {
          setRunId(savedId);
        } else if (res.status !== 501) {
          const msg = typeof data?.error === 'string' ? data.error : 'Failed to save run';
          setSaveError(msg);
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save run');
      } finally {
        setSaving(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Swarm run failed';
      setError(msg);
      pushTrace({ kind: 'error', message: msg });
    } finally {
      setRunning(false);
    }
  };

  const steps = plan?.steps ?? [];
  const spend = useMemo(() => {
    let total = 0;
    const perAgent = new Map<string, number>();

    for (const s of steps) {
      const r = results[s.id];
      const drawn =
        typeof r?.amountDrawn === 'number' && Number.isFinite(r.amountDrawn) ? r.amountDrawn : 0;
      if (!drawn) continue;
      total += drawn;
      perAgent.set(s.agentId, (perAgent.get(s.agentId) ?? 0) + drawn);
    }

    const byAgent = [...perAgent.entries()]
      .map(([agentId, amount]) => ({ agentId, amount }))
      .sort((a, b) => b.amount - a.amount);

    return { total, byAgent };
  }, [results, steps]);

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Mission</label>
          <textarea
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            className="w-full bg-black/20 border border-gray-500/50 rounded px-4 py-3 text-white text-sm focus:border-[#364153] focus:outline-none resize-none h-24"
            placeholder="Describe the mission (the swarm will decompose, execute, review, and synthesize)."
            disabled={planning || running}
          />
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Pattern</label>
            <Dropdown
              value={pattern}
              onChange={(v) => setPattern(v as SwarmPattern)}
              options={PATTERN_OPTIONS}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Max steps</label>
              <input
                value={maxSteps}
                onChange={(e) => setMaxSteps(e.target.value)}
                inputMode="numeric"
                className="w-full bg-black/20 border border-gray-500/50 rounded px-3 py-2 text-white text-sm focus:border-[#364153] focus:outline-none"
                placeholder="6"
                disabled={planning || running}
              />
            </div>
            <div className="flex-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Max budget/step</label>
              <input
                value={maxBudgetPerStep}
                onChange={(e) => setMaxBudgetPerStep(e.target.value)}
                inputMode="decimal"
                className="w-full bg-black/20 border border-gray-500/50 rounded px-3 py-2 text-white text-sm focus:border-[#364153] focus:outline-none"
                placeholder={`(${currencyDisplay})`}
                disabled={planning || running}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-400 select-none">
            <input
              type="checkbox"
              checked={autopilot}
              onChange={(e) => setAutopilot(e.target.checked)}
              disabled={planning || running}
              className="accent-[#00f0ff]"
            />
            Autopilot (critique + patch)
          </label>

          <div className="flex items-center gap-3">
            <PayButton text={planning ? 'Planning...' : 'Plan'} onClick={planMission} disabled={!canPlan} />
            <PayButton text={running ? 'Running...' : 'Run'} onClick={runMission} disabled={!canRun} />
            <button
              onClick={reset}
              disabled={planning || running}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          className="px-4 py-3 rounded text-xs"
          style={{ backgroundColor: 'rgba(255, 50, 50, 0.05)', border: '1px solid rgba(255, 50, 50, 0.5)', color: '#ff3232' }}
        >
          {error}
        </div>
      )}

      {steps.length > 0 && (
        <div className="border border-gray-800 rounded p-3">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Plan</div>
          <div className="space-y-2">
            {steps.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 text-xs border-b border-gray-900 pb-2 last:border-0 last:pb-0">
                <div className="text-gray-300">
                  <span className="text-gray-500 mr-2">{s.id}</span>
                  <span className="text-white font-mono mr-2">{s.agentId}</span>
                  <span className="text-gray-300">{s.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  {results[s.id]?.status && (
                    <span className={`text-[11px] border rounded px-2 py-0.5 ${statusClass(results[s.id]!.status)}`}>
                      {results[s.id]!.status}
                    </span>
                  )}
                  {typeof results[s.id]?.amountDrawn === 'number' && Number.isFinite(results[s.id]!.amountDrawn!) ? (
                    <span className="text-gray-400">
                      {fmtAmount(results[s.id]!.amountDrawn!, currencyDisplay)}
                    </span>
                  ) : null}
                  <span className="text-gray-600">
                    {typeof s.budget === 'number' ? `${s.budget.toFixed(2)} ${currencyDisplay}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {spend.total > 0 && (
            <div className="mt-4 border-t border-gray-900 pt-3">
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Spend</div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-gray-300">
                  Total: <span className="text-white">{fmtAmount(spend.total, currencyDisplay)}</span>
                </span>
                {spend.byAgent.slice(0, 6).map((a) => (
                  <span key={a.agentId} className="text-gray-500">
                    {a.agentId}: <span className="text-gray-300">{fmtAmount(a.amount, currencyDisplay)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {Object.keys(results).length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs uppercase tracking-wider text-gray-500">Step outputs</div>
              {steps.map((s) => {
                const r = results[s.id];
                if (!r) return null;
                const text = r.output?.result ?? r.error ?? '';
                return (
                  <details key={s.id} className="border border-gray-900 rounded p-2">
                    <summary className="cursor-pointer text-xs text-gray-300">
                      <span className="text-gray-500 mr-2">{s.id}</span>
                      <span className="text-white font-mono mr-2">{s.agentId}</span>
                      <span className="text-gray-300">{s.title}</span>
                    </summary>
                    {text && (
                      <pre className="mt-2 text-gray-200 text-xs whitespace-pre-wrap max-h-64 overflow-y-auto">{text}</pre>
                    )}
                  </details>
                );
              })}
            </div>
          )}
        </div>
      )}

      {trace.length > 0 && (
        <div className="border border-gray-800 rounded p-3">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Trace</div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {trace.map((e) => (
              <div key={e.id} className="text-xs flex items-start justify-between gap-4">
                <div className="text-gray-600 shrink-0">{fmtTime(e.at)}</div>
                <div className="text-gray-300 flex-1">
                  <span className="text-gray-500 mr-2">{e.kind}</span>
                  {e.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {critique && (
        <div className="border border-gray-800 rounded p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-xs uppercase tracking-wider text-gray-500">Critique</div>
            <div className="text-xs text-gray-400">
              <span className={critique.ok ? 'text-[#00ff88]' : 'text-yellow-400'}>
                {critique.ok ? 'ok' : 'needs work'}
              </span>
              <span className="text-gray-600 ml-2">{`${critique.score}/100`}</span>
            </div>
          </div>
          {critique.fixes.length > 0 ? (
            <ul className="list-disc ml-4 space-y-1 text-xs text-gray-300">
              {critique.fixes.slice(0, 8).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-gray-500">No changes required.</div>
          )}
        </div>
      )}

      {(saving || runId || saveError) && (
        <div className="border border-gray-800 rounded p-3">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Share</div>
          {saving && <div className="text-xs text-gray-400">Saving run...</div>}
          {runId && (
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <input
                readOnly
                value={`/${locale}/hive/runs/${runId}`}
                className="flex-1 bg-black/20 border border-gray-500/40 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      const path = `/${locale}/hive/runs/${runId}`;
                      const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
                      await navigator.clipboard.writeText(url);
                    } catch {
                      // Ignore.
                    }
                  }}
                  className="text-xs px-3 py-2 border border-gray-700 rounded text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                >
                  Copy
                </button>
                <a
                  href={`/${locale}/hive/runs/${runId}`}
                  className="text-xs px-3 py-2 border border-gray-700 rounded text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                >
                  Open
                </a>
              </div>
            </div>
          )}
          {saveError && <div className="text-xs text-red-400 mt-2">{saveError}</div>}
        </div>
      )}

      {persistenceEnabled && recentRuns.length > 0 && (
        <div className="border border-gray-800 rounded p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-xs uppercase tracking-wider text-gray-500">Recent runs</div>
            <button
              onClick={() => setRunsNonce((n) => n + 1)}
              className="text-xs text-gray-500 hover:text-gray-300"
              disabled={planning || running}
              title="Refresh"
            >
              Refresh
            </button>
          </div>
          <div className="space-y-2">
            {recentRuns.slice(0, 8).map((r) => {
              const when = new Date(r.createdAt).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
              const score =
                typeof r.critiqueScore === 'number' && Number.isFinite(r.critiqueScore) ? Math.round(r.critiqueScore) : null;
              const snippet = r.mission.length > 90 ? `${r.mission.slice(0, 90)}...` : r.mission;

              return (
                <div key={r.id} className="flex items-center justify-between gap-3 text-xs border-b border-gray-900 pb-2 last:border-0 last:pb-0">
                  <div className="text-gray-300">
                    <span className="text-gray-500 mr-2">{when}</span>
                    <span className="text-gray-400 mr-2">{r.pattern}</span>
                    {score !== null && (
                      <span className={r.critiqueOk ? 'text-[#00ff88] mr-2' : 'text-yellow-400 mr-2'}>
                        {score}/100
                      </span>
                    )}
                    <span className="text-gray-200">{snippet}</span>
                  </div>
                  <a
                    href={`/${locale}/hive/runs/${r.id}`}
                    className="text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded px-2 py-1"
                  >
                    Open
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {final?.final && (
        <div className="border border-gray-800 rounded p-3">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Final</div>
          <pre className="text-gray-200 text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">{final.final}</pre>
          {final.followups && final.followups.length > 0 && (
            <div className="mt-3 text-xs text-gray-400">
              <div className="uppercase tracking-wider text-gray-500 mb-1">Follow-ups</div>
              <ul className="list-disc ml-4 space-y-1">
                {final.followups.slice(0, 6).map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
