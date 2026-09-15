import {
  ResumeWorkflowState,
  WorkflowStatus,
  WorkflowType,
} from "@resumeai/shared";
import { registeredAgents } from "../agents/index.js";
import { getAIProvider } from "../providers/index.js";

export interface WorkflowDefinition {
  type: (typeof WorkflowType)[keyof typeof WorkflowType];
  steps: string[];
  maxRetries: number;
}

export const WORKFLOW_DEFINITIONS: Record<string, WorkflowDefinition> = {
  [WorkflowType.CREATE_RESUME]: {
    type: WorkflowType.CREATE_RESUME,
    steps: [
      "IntakeAgent",
      "ContentWriterAgent",
      "FactGuardAgent",
      "QualityReviewerAgent",
    ],
    maxRetries: 3,
  },
  [WorkflowType.JOB_TAILORING]: {
    type: WorkflowType.JOB_TAILORING,
    steps: [
      "ResumeParserAgent",
      "JobAnalyzerAgent",
      "MatcherAgent",
      "StrategyAgent",
      "ContentWriterAgent",
      "FactGuardAgent",
      "ATSAnalyzerAgent",
      "QualityReviewerAgent",
    ],
    maxRetries: 3,
  },
  [WorkflowType.RESUME_REVIEW]: {
    type: WorkflowType.RESUME_REVIEW,
    steps: ["ResumeParserAgent", "ATSAnalyzerAgent", "QualityReviewerAgent"],
    maxRetries: 2,
  },
};

export class WorkflowOrchestrator {
  /**
   * Conceptual execution engine matching LangGraph state machine pattern.
   * Steps execute sequentially with state updates passed forward and validated.
   */
  async executeWorkflow(
    initialState: ResumeWorkflowState,
  ): Promise<ResumeWorkflowState> {
    const definition = WORKFLOW_DEFINITIONS[initialState.workflowType];
    if (!definition) {
      throw new Error(`Unknown workflow type: ${initialState.workflowType}`);
    }

    let currentState: ResumeWorkflowState = {
      ...initialState,
      status: WorkflowStatus.RUNNING,
      startedAt: new Date().toISOString(),
    };

    const provider = getAIProvider();

    for (const stepName of definition.steps) {
      const agent = registeredAgents[stepName as keyof typeof registeredAgents];
      if (!agent) {
        continue;
      }

      const stepResult = await agent.execute(currentState, provider);

      currentState = {
        ...currentState,
        ...stepResult.updatedState,
        totalTokensUsed: currentState.totalTokensUsed + stepResult.tokensUsed,
        estimatedCostUsd: currentState.estimatedCostUsd + stepResult.costUsd,
      };
    }

    currentState.status = WorkflowStatus.COMPLETED;
    currentState.completedAt = new Date().toISOString();

    return currentState;
  }
}

export const workflowOrchestrator = new WorkflowOrchestrator();
