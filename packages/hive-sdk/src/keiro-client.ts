import type {
  AgentInfo,
  AgentStatus,
  DiscoveryQuery,
  KeiroEarning,
  KeiroEarningsStats,
  KeiroJob,
  KeiroMeishiBundle,
  KeiroReceipt,
  RegisterOptions,
} from './types.js';

interface KeiroAgent {
  id: string;
  walletAddress: string;
  name: string;
  personality: 'professional' | 'creative' | 'efficient' | 'balanced';
  skills: string[];
  tier: string;
  creditScore: number;
  tasksCompleted: number;
  disputeCount: number;
  avgQuality: number;
  isActive: boolean;
  createdAt: string;
}

interface ReputationResponse {
  reputation: {
    creditScore: number;
  };
}

const DEFAULT_TIMEOUT_MS = 10_000;

function normalizeCapability(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

export class KeiroApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || 'https://api.kamiyo.ai').replace(/\/+$/, '');
  }

  async registerAgent(walletAddress: string, options: RegisterOptions): Promise<KeiroAgent> {
    const name = options.name?.trim() || `hive-${walletAddress.slice(0, 6)}`;
    const personality = options.personality || 'balanced';
    const payload = {
      walletAddress,
      name,
      personality,
      skills: options.capabilities.map(normalizeCapability),
    };
    const result = await this.request<{ agent: KeiroAgent }>('/api/agents', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return result.agent;
  }

  async updateAgent(agentId: string, updates: Partial<RegisterOptions>): Promise<KeiroAgent> {
    const body: Record<string, unknown> = {};
    if (updates.name) body.name = updates.name.trim();
    if (updates.personality) body.personality = updates.personality;
    if (updates.capabilities?.length) {
      body.skills = updates.capabilities.map(normalizeCapability);
    }

    const result = await this.request<{ agent: KeiroAgent }>(`/api/agents/${encodeURIComponent(agentId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return result.agent;
  }

  async setAgentActive(agentId: string, active: boolean): Promise<KeiroAgent> {
    const current = await this.getAgent(agentId);
    if (!current) {
      throw new Error('Agent not found');
    }

    if (!active) {
      const result = await this.request<{ agent: KeiroAgent }>(`/api/agents/${encodeURIComponent(agentId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      });
      return result.agent;
    }

    if (current.isActive) {
      return current;
    }

    const result = await this.request<{ agent: KeiroAgent }>(
      `/api/agents/${encodeURIComponent(agentId)}/toggle-active`,
      { method: 'POST' }
    );
    return result.agent;
  }

  async getAgent(agentId: string): Promise<KeiroAgent | null> {
    try {
      const result = await this.request<{ agent: KeiroAgent }>(`/api/agents/${encodeURIComponent(agentId)}`);
      return result.agent;
    } catch {
      return null;
    }
  }

  async getAgents(limit = 100): Promise<KeiroAgent[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    try {
      const result = await this.request<{ agents: KeiroAgent[] }>(`/api/agents/leaderboard?limit=${safeLimit}`);
      return result.agents;
    } catch {
      const result = await this.request<{ agents: KeiroAgent[] }>('/api/agents');
      return result.agents.slice(0, safeLimit);
    }
  }

  async discoverAgents(query: DiscoveryQuery): Promise<AgentInfo[]> {
    const agents = await this.getAgents(query.limit ?? 100);
    const mapped = agents.map((agent) => this.mapAgent(agent));
    const normalizedCapability = query.capability ? normalizeCapability(query.capability) : null;
    const normalizedCapabilities = query.capabilities?.map(normalizeCapability) ?? [];

    return mapped.filter((agent) => {
      if (query.status && agent.status !== query.status) return false;
      if (query.minReputation !== undefined && agent.reputation < query.minReputation) return false;
      if (query.maxPrice !== undefined) {
        const price = agent.pricing.perTask ?? agent.pricing.perToken ?? 0;
        if (price > query.maxPrice) return false;
      }
      if (normalizedCapability && !agent.capabilities.includes(normalizedCapability)) return false;
      if (normalizedCapabilities.length > 0) {
        const hasMatch = normalizedCapabilities.some((cap) => agent.capabilities.includes(cap));
        if (!hasMatch) return false;
      }
      return true;
    });
  }

  async getAgentReputation(agentId: string): Promise<number | null> {
    try {
      const result = await this.request<ReputationResponse>(`/api/reputation/agent/${encodeURIComponent(agentId)}`);
      return Math.max(0, Math.min(1000, Math.round(result.reputation.creditScore * 10)));
    } catch {
      return null;
    }
  }

  async getOpenJobs(): Promise<KeiroJob[]> {
    const result = await this.request<{ jobs: KeiroJob[] }>('/api/jobs/open');
    return result.jobs;
  }

  async getMatchingJobs(agentId: string): Promise<KeiroJob[]> {
    const result = await this.request<{ jobs: KeiroJob[] }>(`/api/jobs/matching/${encodeURIComponent(agentId)}`);
    return result.jobs;
  }

  async getAgentEarnings(agentId: string): Promise<KeiroEarning[]> {
    const result = await this.request<{ earnings: KeiroEarning[] }>(
      `/api/earnings/agent/${encodeURIComponent(agentId)}`
    );
    return result.earnings;
  }

  async getAgentEarningsStats(agentId: string): Promise<KeiroEarningsStats> {
    const result = await this.request<{ stats: KeiroEarningsStats }>(
      `/api/earnings/agent/${encodeURIComponent(agentId)}/stats`
    );
    return result.stats;
  }

  async getAgentReceipts(agentId: string, limit = 50): Promise<KeiroReceipt[]> {
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const result = await this.request<{ receipts: KeiroReceipt[] }>(
      `/api/receipts/agent/${encodeURIComponent(agentId)}?limit=${safeLimit}`
    );
    return result.receipts;
  }

  async getAgentMeishi(agentId: string): Promise<KeiroMeishiBundle> {
    const passport = await this.getNullableResource(`/api/meishi/passport/${encodeURIComponent(agentId)}`, 'passport');
    const mandate = await this.getNullableResource(`/api/meishi/mandate/${encodeURIComponent(agentId)}`, 'mandate');
    return { passport, mandate };
  }

  mapAgent(agent: KeiroAgent): AgentInfo {
    const inferredSuccess = agent.tasksCompleted === 0
      ? 100
      : Math.max(0, Math.min(100, Math.round((1 - agent.disputeCount / agent.tasksCompleted) * 100)));
    const status: AgentStatus = agent.isActive ? 'active' : 'inactive';
    const capabilities = agent.skills.map(normalizeCapability);

    const parsedRegisteredAt = Date.parse(agent.createdAt);
    return {
      id: agent.id,
      address: agent.walletAddress,
      capabilities,
      pricing: { perTask: 0, currency: 'SOL' },
      endpoint: `${this.baseUrl}/api/agents/${encodeURIComponent(agent.id)}`,
      reputation: Math.max(0, Math.min(1000, Math.round(agent.creditScore * 10))),
      totalJobs: Math.max(0, agent.tasksCompleted),
      successRate: inferredSuccess,
      avgResponseTime: 5000,
      status,
      registeredAt: Number.isFinite(parsedRegisteredAt) ? parsedRegisteredAt : Date.now(),
      reputationTier: agent.tier,
      metadata: {
        name: agent.name,
        personality: agent.personality,
        avgQuality: agent.avgQuality,
      },
    };
  }

  private async getNullableResource(
    path: string,
    key: string
  ): Promise<Record<string, unknown> | null> {
    try {
      const data = await this.request<Record<string, Record<string, unknown> | null>>(path);
      return data[key] ?? null;
    } catch {
      return null;
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
          ...init?.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `Keiro API request failed with status ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Keiro API returned non-JSON response');
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
