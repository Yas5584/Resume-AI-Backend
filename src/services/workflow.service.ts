import {
  workflowRepository,
  WorkflowRepository,
} from "../repositories/workflow.repository.js";
import {
  workflowOrchestrator,
  WorkflowOrchestrator,
} from "../ai/workflows/index.js";
import { AppError } from "../errors/index.js";
import { TriggerWorkflowRequest, ResumeWorkflowState } from "@resumeai/shared";
import { WorkflowType, WorkflowStatus } from "@resumeai/database";
import crypto from "crypto";

export class WorkflowService {
  constructor(
    private workflowRepo: WorkflowRepository = workflowRepository,
    private orchestrator: WorkflowOrchestrator = workflowOrchestrator,
  ) {}

  async listWorkflows(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const { items, total } = await this.workflowRepo.listByUserId(
      userId,
      skip,
      limit,
    );
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getWorkflow(id: string, userId: string) {
    const run = await this.workflowRepo.findByIdAndUserId(id, userId);
    if (!run) {
      throw AppError.notFound("Workflow execution");
    }
    return run;
  }

  async triggerWorkflow(userId: string, req: TriggerWorkflowRequest) {
    const workflowId = crypto.randomUUID();

    // Persist pending workflow in database
    const workflowRun = await this.workflowRepo.create({
      userId,
      resumeId: req.resumeId,
      workflowType: req.workflowType as WorkflowType,
      inputPayload: req,
    });

    const initialState: ResumeWorkflowState = {
      workflowId,
      userId,
      workflowType: req.workflowType as WorkflowType,
      status: WorkflowStatus.PENDING,
      retryCount: 0,
      maxRetries: 3,
      resumeId: req.resumeId,
      jobDescriptionId: req.jobId,
      rawResumeText: req.rawInput,
      revisionHistory: [],
      errors: [],
      metadata: {},
      totalTokensUsed: 0,
      estimatedCostUsd: 0,
      startedAt: new Date().toISOString(),
    };

    // Conceptual orchestration call (in background worker in production)
    const resultState = await this.orchestrator.executeWorkflow(initialState);

    await this.workflowRepo.updateStatus(
      workflowRun.id,
      WorkflowStatus.COMPLETED,
      resultState,
      undefined,
      resultState.totalTokensUsed,
      resultState.estimatedCostUsd,
    );

    return {
      workflowRunId: workflowRun.id,
      status: WorkflowStatus.COMPLETED,
      state: resultState,
    };
  }
}

export const workflowService = new WorkflowService();
