import { ResumeWorkflowState, AgentNameType } from "@resumeai/shared";
import { AIProvider } from "../providers/ai-provider.interface.js";

export interface AgentExecutionResult {
  updatedState: Partial<ResumeWorkflowState>;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  notes?: string;
}

export interface AgentRetryPolicy {
  maxRetries: number;
  initialBackoffMs: number;
  backoffMultiplier: number;
}

export interface AIAgent<TInput = unknown, TOutput = unknown> {
  readonly name: AgentNameType;
  readonly description: string;
  readonly retryPolicy: AgentRetryPolicy;

  execute(
    state: ResumeWorkflowState,
    provider: AIProvider,
  ): Promise<AgentExecutionResult>;
}
