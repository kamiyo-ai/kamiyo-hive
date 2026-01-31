const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://kamiyo-protocol-4c70.onrender.com';

// Auth token storage
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export interface SwarmTeam {
  id: string;
  name: string;
  currency: string;
  dailyLimit: number;
  poolBalance: number;
  memberCount: number;
  dailySpend: number;
  createdAt: number;
}

export interface SwarmMember {
  id: string;
  agentId: string;
  role: string;
  drawLimit: number;
  drawnToday: number;
}

export interface SwarmDraw {
  id: string;
  agentId: string;
  amount: number;
  purpose: string | null;
  blindfoldPaymentId: string | null;
  blindfoldStatus: string;
  createdAt: number;
}

export interface SwarmTeamDetail {
  id: string;
  name: string;
  currency: string;
  dailyLimit: number;
  poolBalance: number;
  dailySpend: number;
  createdAt: number;
  members: SwarmMember[];
  recentDraws: SwarmDraw[];
}

export interface CreateTeamInput {
  name: string;
  currency: string;
  dailyLimit: number;
  members?: Array<{ agentId: string; role?: string; drawLimit?: number }>;
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    let message = `API error: ${res.status}`;
    if (typeof err.error === 'string') {
      message = err.error;
    } else if (err.error?.message) {
      message = err.error.message;
    } else if (typeof err.message === 'string') {
      message = err.message;
    } else if (res.status === 401) {
      message = 'Authentication required';
    } else if (res.status === 403) {
      message = 'Access denied';
    }
    throw new Error(message);
  }
  return res.json();
}

// Auth functions
export async function getChallenge(wallet: string): Promise<{ challenge: string; expiresAt: number }> {
  return api(`/api/auth/challenge?wallet=${encodeURIComponent(wallet)}`);
}

export async function authenticateWallet(wallet: string, signature: string): Promise<{ token: string; wallet: string }> {
  return api('/api/auth/wallet', {
    method: 'POST',
    body: JSON.stringify({ wallet, signature }),
  });
}

export async function listTeams(): Promise<SwarmTeam[]> {
  const data = await api<{ teams: SwarmTeam[] }>('/api/swarm-teams');
  return data.teams;
}

export async function createTeam(input: CreateTeamInput): Promise<SwarmTeamDetail> {
  return api<SwarmTeamDetail>('/api/swarm-teams', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getTeam(teamId: string): Promise<SwarmTeamDetail> {
  return api<SwarmTeamDetail>(`/api/swarm-teams/${teamId}`);
}

export async function addMember(
  teamId: string,
  data: { agentId: string; role?: string; drawLimit?: number }
): Promise<SwarmMember> {
  return api<SwarmMember>(`/api/swarm-teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteTeam(teamId: string): Promise<void> {
  await api(`/api/swarm-teams/${teamId}`, { method: 'DELETE' });
}

export async function removeMember(teamId: string, memberId: string): Promise<void> {
  await api(`/api/swarm-teams/${teamId}/members/${memberId}`, { method: 'DELETE' });
}

export async function fundTeam(teamId: string, amount: number): Promise<{ poolBalance: number }> {
  return api<{ success: boolean; poolBalance: number }>(`/api/swarm-teams/${teamId}/fund`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export async function updateBudget(
  teamId: string,
  data: { dailyLimit?: number; memberLimits?: Record<string, number> }
): Promise<void> {
  await api(`/api/swarm-teams/${teamId}/budget`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function getDraws(
  teamId: string,
  params?: { limit?: number; offset?: number; agentId?: string }
): Promise<{ draws: SwarmDraw[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.agentId) query.set('agentId', params.agentId);
  const qs = query.toString();
  return api<{ draws: SwarmDraw[]; total: number }>(
    `/api/swarm-teams/${teamId}/draws${qs ? `?${qs}` : ''}`
  );
}

// Fund deposit flow (Blindfold integration)
export interface FundDeposit {
  depositId: string;
  paymentId: string;
  cryptoAddress: string;
  cryptoAmount: string;
  expiresAt: string;
  status: string;
}

export async function initiateFunding(teamId: string, amount: number): Promise<FundDeposit> {
  return api<FundDeposit>(`/api/swarm-teams/${teamId}/fund`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export async function confirmFunding(teamId: string, depositId: string): Promise<{
  status: string;
  poolBalance?: number;
}> {
  return api(`/api/swarm-teams/${teamId}/fund/${depositId}/confirm`, { method: 'POST' });
}

export async function fundFromCredits(teamId: string, wallet: string, amountUsd: number): Promise<{
  success: boolean;
  poolBalance: number;
}> {
  return api(`/api/swarm-teams/${teamId}/fund-credits`, {
    method: 'POST',
    body: JSON.stringify({ wallet, amountUsd }),
  });
}

export async function fundWithTokens(teamId: string, signedTransaction: string): Promise<{
  success: boolean;
  poolBalance: number;
  tokenAmount: number;
  signature: string;
}> {
  return api(`/api/swarm-teams/${teamId}/fund-tokens`, {
    method: 'POST',
    body: JSON.stringify({ signedTransaction }),
  });
}

// Task submission
export interface TaskSubmission {
  memberId: string;
  description: string;
  budget?: number;
}

export interface TaskResult {
  taskId: string;
  status: string;
  output?: { taskType: string; result: string; tokens: { input_tokens: number; output_tokens: number } };
  amountDrawn?: number;
  error?: string;
}

export async function submitTask(teamId: string, task: TaskSubmission): Promise<TaskResult> {
  return api<TaskResult>(`/api/swarm-teams/${teamId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task),
  });
}
