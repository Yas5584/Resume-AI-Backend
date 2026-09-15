import {
  prisma,
  AIWorkflowRun,
  WorkflowStatus,
  WorkflowType,
  Prisma,
} from "@resumeai/database";

export class WorkflowRepository {
  async findByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<AIWorkflowRun | null> {
    return prisma.aIWorkflowRun.findFirst({
      where: { id, userId },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
        aiUsages: true,
      },
    });
  }

  async listByUserId(
    userId: string,
    skip = 0,
    take = 20,
  ): Promise<{ items: AIWorkflowRun[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.aIWorkflowRun.findMany({
        where: { userId },
        orderBy: { startedAt: "desc" },
        skip,
        take,
      }),
      prisma.aIWorkflowRun.count({
        where: { userId },
      }),
    ]);

    return { items, total };
  }

  async create(data: {
    userId: string;
    resumeId?: string;
    workflowType: WorkflowType;
    inputPayload: Prisma.InputJsonValue;
  }): Promise<AIWorkflowRun> {
    return prisma.aIWorkflowRun.create({
      data: {
        userId: data.userId,
        resumeId: data.resumeId,
        workflowType: data.workflowType,
        status: WorkflowStatus.PENDING,
        inputPayload: data.inputPayload,
      },
    });
  }

  async updateStatus(
    id: string,
    status: WorkflowStatus,
    outputPayload?: Prisma.InputJsonValue,
    errorMessage?: string,
    tokensUsed = 0,
    costEstimate = 0.0,
  ): Promise<AIWorkflowRun> {
    return prisma.aIWorkflowRun.update({
      where: { id },
      data: {
        status,
        ...(outputPayload ? { outputPayload } : {}),
        ...(errorMessage ? { errorMessage } : {}),
        tokensUsed: { increment: tokensUsed },
        costEstimate: { increment: costEstimate },
        ...(status === WorkflowStatus.COMPLETED ||
        status === WorkflowStatus.FAILED
          ? { completedAt: new Date() }
          : {}),
      },
    });
  }

  async recordStep(data: {
    workflowRunId: string;
    agentName: string;
    stepOrder: number;
    status: WorkflowStatus;
    inputPayload?: Prisma.InputJsonValue;
    outputPayload?: Prisma.InputJsonValue;
    tokensUsed?: number;
    durationMs?: number;
    errorMessage?: string;
  }) {
    return prisma.aIWorkflowStep.create({
      data: {
        workflowRunId: data.workflowRunId,
        agentName: data.agentName,
        stepOrder: data.stepOrder,
        status: data.status,
        inputPayload: data.inputPayload,
        outputPayload: data.outputPayload,
        tokensUsed: data.tokensUsed ?? 0,
        durationMs: data.durationMs ?? 0,
        errorMessage: data.errorMessage,
      },
    });
  }

  async recordUsage(data: {
    userId: string;
    workflowRunId?: string;
    agentName: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
  }) {
    return prisma.aIUsage.create({
      data: {
        userId: data.userId,
        workflowRunId: data.workflowRunId,
        agentName: data.agentName,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.totalTokens,
        estimatedCost: data.estimatedCost,
      },
    });
  }
}

export const workflowRepository = new WorkflowRepository();
