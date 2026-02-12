import type {
  AgentInfo,
  Capability,
  DiscoveryQuery,
  DiscoveryResult,
} from './types.js';
import { KeiroApiClient } from './keiro-client.js';

const DEFAULT_API_ENDPOINT = 'https://api.kamiyo.ai';
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class AgentDiscovery {
  private apiEndpoint: string;
  private cache: Map<string, { data: AgentInfo[]; timestamp: number }> = new Map();
  private cacheTtlMs: number;
  private keiro: KeiroApiClient;

  constructor(config: { apiEndpoint?: string; cacheTtlMs?: number } = {}) {
    this.apiEndpoint = config.apiEndpoint || DEFAULT_API_ENDPOINT;
    this.cacheTtlMs = config.cacheTtlMs ?? 60_000;
    this.keiro = new KeiroApiClient(this.apiEndpoint);
  }

  async discover(query: DiscoveryQuery = {}): Promise<DiscoveryResult> {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = query.offset ?? 0;

    const cacheKey = this.buildCacheKey(query);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return this.paginateResults(cached.data, limit, offset);
    }

    const agents = await this.fetchAgents(query);
    this.cache.set(cacheKey, { data: agents, timestamp: Date.now() });
    return this.paginateResults(agents, limit, offset);
  }

  async findBestMatch(
    capability: Capability,
    options: {
      minReputation?: number;
      maxPrice?: number;
      priceCurrency?: 'USD' | 'SOL';
    } = {}
  ): Promise<AgentInfo | null> {
    const result = await this.discover({
      capability,
      minReputation: options.minReputation ?? 500,
      maxPrice: options.maxPrice,
      priceCurrency: options.priceCurrency,
      limit: 10,
    });

    if (!result.agents.length) return null;

    return result.agents.reduce((best, agent) => {
      const bestScore = this.calculateScore(best);
      const agentScore = this.calculateScore(agent);
      return agentScore > bestScore ? agent : best;
    });
  }

  async findByCapabilities(
    capabilities: Capability[],
    options: { minReputation?: number; requireAll?: boolean } = {}
  ): Promise<DiscoveryResult> {
    const result = await this.discover({
      capabilities,
      minReputation: options.minReputation,
      limit: 50,
    });

    if (options.requireAll) {
      const filtered = result.agents.filter(agent =>
        capabilities.every(cap => agent.capabilities.includes(cap))
      );
      return {
        agents: filtered,
        total: filtered.length,
        hasMore: false,
      };
    }

    return result;
  }

  private async fetchAgents(query: DiscoveryQuery): Promise<AgentInfo[]> {
    try {
      const filtered = await this.keiro.discoverAgents(query);
      filtered.sort((a, b) => b.reputation - a.reputation);
      return filtered;
    } catch {
      return [];
    }
  }

  private paginateResults(
    agents: AgentInfo[],
    limit: number,
    offset: number
  ): DiscoveryResult {
    const paginated = agents.slice(offset, offset + limit);
    return {
      agents: paginated,
      total: agents.length,
      hasMore: offset + limit < agents.length,
    };
  }

  private buildCacheKey(query: DiscoveryQuery): string {
    return JSON.stringify({
      cap: query.capability,
      caps: query.capabilities,
      minRep: query.minReputation,
      maxPrice: query.maxPrice,
      status: query.status,
    });
  }

  private calculateScore(agent: AgentInfo): number {
    const reputationWeight = 0.4;
    const successRateWeight = 0.3;
    const responseTimeWeight = 0.2;
    const jobCountWeight = 0.1;

    const reputationScore = agent.reputation / 1000;
    const successScore = agent.successRate / 100;
    const responseScore = Math.max(0, 1 - agent.avgResponseTime / 30000);
    const jobScore = Math.min(1, agent.totalJobs / 500);

    return (
      reputationScore * reputationWeight +
      successScore * successRateWeight +
      responseScore * responseTimeWeight +
      jobScore * jobCountWeight
    );
  }

  clearCache(): void {
    this.cache.clear();
  }
}
