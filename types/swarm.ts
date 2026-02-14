export type SwarmPattern = 'pipeline' | 'debate' | 'red_team';

export type SwarmMemberInput = {
  memberId: string;
  agentId: string;
  role: string;
  drawLimit: number;
};

export type SwarmPlanStep = {
  id: string;
  title: string;
  memberId: string;
  agentId: string;
  instruction: string;
  budget?: number;
};

export type SwarmPlanResponse = {
  steps: SwarmPlanStep[];
  synthesisPrompt?: string;
};

export type SwarmSynthesisInput = {
  mission: string;
  outputs: Array<{
    stepId: string;
    title: string;
    agentId: string;
    result: string;
  }>;
};

export type SwarmSynthesisResponse = {
  final: string;
  summary?: string;
  followups?: string[];
};

export type SwarmCritiqueInput = {
  mission: string;
  final: string;
  outputs?: Array<{
    stepId: string;
    title: string;
    agentId: string;
    result: string;
  }>;
  members: SwarmMemberInput[];
  remainingSteps?: number;
  maxBudgetPerStep?: number | null;
};

export type SwarmCritiqueResponse = {
  ok: boolean;
  score: number;
  fixes: string[];
  shouldContinue: boolean;
  nextStep?: {
    title: string;
    memberId: string;
    instruction: string;
    budget?: number;
  };
};
