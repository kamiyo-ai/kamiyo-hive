type LlmProvider = 'openai' | 'anthropic';

type JsonPrompt = {
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
};

function getFirstDefined(...values: Array<string | undefined>) {
  for (const v of values) {
    if (v && v.trim()) return v.trim();
  }
  return null;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue with bracket scan.
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  const slice = trimmed.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

async function invokeOpenAI({ system, prompt, maxTokens = 1200, temperature = 0.2 }: JsonPrompt): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const model =
    getFirstDefined(process.env.SWARM_OPENAI_MODEL, process.env.OPENAI_MODEL) ?? 'gpt-4o-mini';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = typeof data?.error?.message === 'string' ? data.error.message : `OpenAI error: ${res.status}`;
    throw new Error(msg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('OpenAI response missing content');
  }
  return content;
}

async function invokeAnthropic({ system, prompt, maxTokens = 1200, temperature = 0.2 }: JsonPrompt): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const model =
    getFirstDefined(process.env.SWARM_ANTHROPIC_MODEL, process.env.ANTHROPIC_MODEL) ??
    'claude-3-5-sonnet-20241022';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = typeof data?.error?.message === 'string' ? data.error.message : `Anthropic error: ${res.status}`;
    throw new Error(msg);
  }

  const parts = data?.content;
  let text = '';
  if (Array.isArray(parts)) {
    for (const p of parts) {
      if (!p || typeof p !== 'object') continue;
      const t = (p as { text?: unknown }).text;
      if (typeof t === 'string') text += t;
    }
  }

  if (!text.trim()) {
    throw new Error('Anthropic response missing content');
  }

  return text;
}

function pickProvider(): LlmProvider | null {
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

export async function invokeJson<T>(args: JsonPrompt): Promise<{ value: T; provider: LlmProvider; raw: string } | null> {
  const provider = pickProvider();
  if (!provider) return null;

  const raw = provider === 'openai' ? await invokeOpenAI(args) : await invokeAnthropic(args);
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  return { value: parsed as T, provider, raw };
}
