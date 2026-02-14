import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

type Props = {
  params: Promise<{ locale: string; runId: string }>;
};

function fmtDate(d: Date) {
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function SwarmRunPage({ params }: Props) {
  const { locale, runId } = await params;

  if (!prisma) {
    return (
      <div className="min-h-screen pt-24 md:pt-28 pb-10 px-5 max-w-[1100px] mx-auto">
        <h1 className="text-2xl font-medium text-white mb-3">Swarm run</h1>
        <p className="text-sm text-gray-500">Persistence is not configured for this deployment.</p>
      </div>
    );
  }

  const run = await prisma.swarmRun.findUnique({
    where: { id: runId },
    include: { events: { orderBy: { at: 'asc' } } },
  });

  if (!run) notFound();

  const plan = run.plan as unknown as { steps?: Array<Record<string, unknown>> };
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  const outputs = Array.isArray(run.outputs) ? (run.outputs as unknown[]) : [];
  const final = run.final as unknown as { final?: unknown; summary?: unknown; followups?: unknown };
  const critique = run.critique as unknown as { ok?: unknown; score?: unknown; fixes?: unknown } | null;

  const finalText = typeof final?.final === 'string' ? final.final : '';
  const followups = Array.isArray(final?.followups) ? final.followups.filter((f) => typeof f === 'string') : [];
  const fixes = Array.isArray(critique?.fixes) ? critique!.fixes.filter((f) => typeof f === 'string') : [];

  return (
    <div className="min-h-screen pt-24 md:pt-28 pb-10 px-5 max-w-[1400px] mx-auto">
      <div className="mb-10">
        <p className="font-light text-sm uppercase tracking-widest gradient-text mb-3">— Hive Swarm Run</p>
        <h1 className="text-2xl md:text-3xl font-medium text-white mb-3">Mission</h1>
        <p className="text-gray-300 whitespace-pre-wrap">{run.mission}</p>
        <div className="mt-4 text-xs text-gray-500 flex flex-wrap gap-3">
          <span>Pattern: {run.pattern}</span>
          <span>Max steps: {run.maxSteps}</span>
          {typeof run.maxBudgetPerStep === 'number' && Number.isFinite(run.maxBudgetPerStep) ? (
            <span>Max budget/step: {run.maxBudgetPerStep.toFixed(2)}</span>
          ) : null}
          <span>Created: {fmtDate(run.createdAt)}</span>
          <Link href={`/${locale}/hive/${run.teamId}`} className="text-gray-300 hover:text-white">
            Open team
          </Link>
        </div>
      </div>

      {critique && (typeof critique.score === 'number' || fixes.length > 0) && (
        <div className="border border-gray-800 rounded p-4 mb-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-xs uppercase tracking-wider text-gray-500">Critique</div>
            <div className="text-xs text-gray-400">
              <span className={critique.ok ? 'text-[#00ff88]' : 'text-yellow-400'}>
                {critique.ok ? 'ok' : 'needs work'}
              </span>
              {typeof critique.score === 'number' && Number.isFinite(critique.score) ? (
                <span className="text-gray-600 ml-2">{`${Math.round(critique.score)}/100`}</span>
              ) : null}
            </div>
          </div>
          {fixes.length > 0 ? (
            <ul className="list-disc ml-4 space-y-1 text-sm text-gray-300">
              {fixes.slice(0, 10).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-500">No changes required.</div>
          )}
        </div>
      )}

      {steps.length > 0 && (
        <div className="border border-gray-800 rounded p-4 mb-6">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">Plan</div>
          <div className="space-y-2">
            {steps.map((s, i) => {
              const id = typeof s.id === 'string' ? s.id : `s${i + 1}`;
              const title = typeof s.title === 'string' ? s.title : '';
              const agentId = typeof s.agentId === 'string' ? s.agentId : '';
              const instruction = typeof s.instruction === 'string' ? s.instruction : '';

              return (
                <details key={id} className="border border-gray-900 rounded p-3">
                  <summary className="cursor-pointer text-sm text-gray-200">
                    <span className="text-gray-500 mr-2">{id}</span>
                    <span className="text-white font-mono mr-2">{agentId}</span>
                    <span className="text-gray-300">{title}</span>
                  </summary>
                  {instruction ? (
                    <pre className="mt-3 text-xs text-gray-200 whitespace-pre-wrap max-h-64 overflow-y-auto">
                      {instruction}
                    </pre>
                  ) : (
                    <div className="mt-3 text-xs text-gray-500">No instruction captured.</div>
                  )}
                </details>
              );
            })}
          </div>
        </div>
      )}

      {run.events.length > 0 && (
        <div className="border border-gray-800 rounded p-4 mb-6">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">Trace</div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {run.events.map((e) => (
              <div key={e.id} className="text-xs flex items-start justify-between gap-4">
                <div className="text-gray-600 shrink-0">{fmtDate(e.at)}</div>
                <div className="text-gray-300 flex-1">
                  <span className="text-gray-500 mr-2">{e.kind}</span>
                  {e.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {finalText && (
        <div className="border border-gray-800 rounded p-4 mb-6">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">Final</div>
          <pre className="text-sm text-gray-200 whitespace-pre-wrap">{finalText}</pre>
          {followups.length > 0 && (
            <div className="mt-5 text-sm text-gray-300">
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Follow-ups</div>
              <ul className="list-disc ml-4 space-y-1">
                {followups.slice(0, 10).map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {outputs.length > 0 && (
        <div className="border border-gray-800 rounded p-4">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">Step outputs</div>
          <div className="space-y-2">
            {outputs.slice(0, 30).map((o, i) => {
              if (!o || typeof o !== 'object') return null;
              const oo = o as Record<string, unknown>;
              const stepId = typeof oo.stepId === 'string' ? oo.stepId : `s${i + 1}`;
              const title = typeof oo.title === 'string' ? oo.title : '';
              const agentId = typeof oo.agentId === 'string' ? oo.agentId : '';
              const result = typeof oo.result === 'string' ? oo.result : '';
              return (
                <details key={stepId} className="border border-gray-900 rounded p-3">
                  <summary className="cursor-pointer text-sm text-gray-200">
                    <span className="text-gray-500 mr-2">{stepId}</span>
                    <span className="text-white font-mono mr-2">{agentId}</span>
                    <span className="text-gray-300">{title}</span>
                  </summary>
                  {result ? (
                    <pre className="mt-3 text-xs text-gray-200 whitespace-pre-wrap max-h-72 overflow-y-auto">
                      {result}
                    </pre>
                  ) : (
                    <div className="mt-3 text-xs text-gray-500">No output captured.</div>
                  )}
                </details>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

