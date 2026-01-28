/**
 * Kamiyo Indexer Client
 * GraphQL client for querying Hyperliquid contract events
 */

const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'https://kamiyo-indexer-v2.onrender.com';

interface Agent {
  id: string;
  owner: string;
  name: string;
  stake: string;
  registeredAt: string;
  totalTrades: string;
  totalPnl: string;
  copiers: string;
  successfulTrades: string;
  active: boolean;
}

interface CopyPosition {
  id: string;
  copier: string;
  agent: string;
  amount: string;
  leverage: number;
  openedAt: string;
  closedAt: string | null;
  currentValue: string;
  pnl: string | null;
  status: string;
}

interface Dispute {
  id: string;
  positionId: string;
  filer: string;
  resolved: boolean;
  ruling: boolean | null;
  refundAmount: string | null;
  filedAt: string;
  resolvedAt: string | null;
}

async function query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${INDEXER_URL}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: gql, variables }),
  });

  if (!res.ok) {
    throw new Error(`Indexer error: ${res.status}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || 'GraphQL error');
  }

  return json.data;
}

export async function getAgents(limit = 50, offset = 0): Promise<Agent[]> {
  const data = await query<{ agents: Agent[] }>(`
    query GetAgents($limit: Int, $offset: Int) {
      agents(limit: $limit, offset: $offset, orderBy: "stake", orderDirection: "desc") {
        id
        owner
        name
        stake
        registeredAt
        totalTrades
        totalPnl
        copiers
        successfulTrades
        active
      }
    }
  `, { limit, offset });

  return data.agents;
}

export async function getAgent(id: string): Promise<Agent | null> {
  const data = await query<{ agent: Agent | null }>(`
    query GetAgent($id: String!) {
      agent(id: $id) {
        id
        owner
        name
        stake
        registeredAt
        totalTrades
        totalPnl
        copiers
        successfulTrades
        active
      }
    }
  `, { id });

  return data.agent;
}

export async function getPositionsByUser(copier: string): Promise<CopyPosition[]> {
  const data = await query<{ copyPositions: CopyPosition[] }>(`
    query GetUserPositions($copier: String!) {
      copyPositions(where: { copier: $copier }, orderBy: "openedAt", orderDirection: "desc") {
        id
        copier
        agent
        amount
        leverage
        openedAt
        closedAt
        currentValue
        pnl
        status
      }
    }
  `, { copier: copier.toLowerCase() });

  return data.copyPositions;
}

export async function getPositionsByAgent(agent: string): Promise<CopyPosition[]> {
  const data = await query<{ copyPositions: CopyPosition[] }>(`
    query GetAgentPositions($agent: String!) {
      copyPositions(where: { agent: $agent }, orderBy: "openedAt", orderDirection: "desc") {
        id
        copier
        agent
        amount
        leverage
        openedAt
        closedAt
        currentValue
        pnl
        status
      }
    }
  `, { agent: agent.toLowerCase() });

  return data.copyPositions;
}

export async function getDisputes(limit = 20): Promise<Dispute[]> {
  const data = await query<{ disputes: Dispute[] }>(`
    query GetDisputes($limit: Int) {
      disputes(limit: $limit, orderBy: "filedAt", orderDirection: "desc") {
        id
        positionId
        filer
        resolved
        ruling
        refundAmount
        filedAt
        resolvedAt
      }
    }
  `, { limit });

  return data.disputes;
}

export async function getLeaderboard(): Promise<Agent[]> {
  const data = await query<{ agents: Agent[] }>(`
    query Leaderboard {
      agents(limit: 100, where: { active: true }, orderBy: "totalPnl", orderDirection: "desc") {
        id
        name
        stake
        totalTrades
        totalPnl
        copiers
        successfulTrades
      }
    }
  `);

  return data.agents;
}
