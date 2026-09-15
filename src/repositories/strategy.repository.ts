import {
  prisma,
  ResumeStrategy,
  StrategyApprovalStatus,
  Prisma,
} from "@resumeai/database";

export type StrategyWithRelations = Prisma.ResumeStrategyGetPayload<{
  include: {
    resume: {
      select: {
        id: true;
        title: true;
        updatedAt: true;
        currentTemplateId: true;
      };
    };
    job: {
      select: {
        id: true;
        title: true;
        company: true;
        updatedAt: true;
        status: true;
      };
    };
    match: {
      select: {
        id: true;
        matchScore: true;
        updatedAt: true;
      };
    };
  };
}>;

export class StrategyRepository {
  async findByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<StrategyWithRelations | null> {
    return prisma.resumeStrategy.findFirst({
      where: { id, userId },
      include: {
        resume: {
          select: {
            id: true,
            title: true,
            updatedAt: true,
            currentTemplateId: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            updatedAt: true,
            status: true,
          },
        },
        match: {
          select: {
            id: true,
            matchScore: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async findByResumeAndJob(
    userId: string,
    resumeId: string,
    jobId: string,
  ): Promise<StrategyWithRelations | null> {
    return prisma.resumeStrategy.findFirst({
      where: { userId, resumeId, jobId },
      orderBy: { createdAt: "desc" },
      include: {
        resume: {
          select: {
            id: true,
            title: true,
            updatedAt: true,
            currentTemplateId: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            updatedAt: true,
            status: true,
          },
        },
        match: {
          select: {
            id: true,
            matchScore: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async listByUserId(
    userId: string,
    skip = 0,
    take = 20,
  ): Promise<{ items: StrategyWithRelations[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.resumeStrategy.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          resume: {
            select: {
              id: true,
              title: true,
              updatedAt: true,
              currentTemplateId: true,
            },
          },
          job: {
            select: {
              id: true,
              title: true,
              company: true,
              updatedAt: true,
              status: true,
            },
          },
          match: {
            select: {
              id: true,
              matchScore: true,
              updatedAt: true,
            },
          },
        },
      }),
      prisma.resumeStrategy.count({
        where: { userId },
      }),
    ]);

    return { items, total };
  }

  async create(data: {
    userId: string;
    resumeId: string;
    jobId: string;
    matchId?: string | null;
    strategyVersion: string;
    status?: StrategyApprovalStatus;
    resumeUpdatedAt?: Date | null;
    jobUpdatedAt?: Date | null;
    matchUpdatedAt?: Date | null;
    strategyData: Prisma.InputJsonValue;
  }): Promise<StrategyWithRelations> {
    return prisma.resumeStrategy.create({
      data: {
        userId: data.userId,
        resumeId: data.resumeId,
        jobId: data.jobId,
        matchId: data.matchId,
        strategyVersion: data.strategyVersion,
        status: data.status || "DRAFT",
        resumeUpdatedAt: data.resumeUpdatedAt,
        jobUpdatedAt: data.jobUpdatedAt,
        matchUpdatedAt: data.matchUpdatedAt,
        strategyData: data.strategyData,
      },
      include: {
        resume: {
          select: {
            id: true,
            title: true,
            updatedAt: true,
            currentTemplateId: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            updatedAt: true,
            status: true,
          },
        },
        match: {
          select: {
            id: true,
            matchScore: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    userId: string,
    data: {
      status?: StrategyApprovalStatus;
      strategyVersion?: string;
      resumeUpdatedAt?: Date | null;
      jobUpdatedAt?: Date | null;
      matchUpdatedAt?: Date | null;
      strategyData?: Prisma.InputJsonValue;
    },
  ): Promise<StrategyWithRelations> {
    const existing = await prisma.resumeStrategy.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new Error("Strategy not found or access denied");
    }

    return prisma.resumeStrategy.update({
      where: { id },
      data: {
        status: data.status,
        strategyVersion: data.strategyVersion,
        resumeUpdatedAt: data.resumeUpdatedAt,
        jobUpdatedAt: data.jobUpdatedAt,
        matchUpdatedAt: data.matchUpdatedAt,
        strategyData: data.strategyData,
      },
      include: {
        resume: {
          select: {
            id: true,
            title: true,
            updatedAt: true,
            currentTemplateId: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            updatedAt: true,
            status: true,
          },
        },
        match: {
          select: {
            id: true,
            matchScore: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async updateStatus(
    id: string,
    userId: string,
    status: StrategyApprovalStatus,
  ): Promise<StrategyWithRelations> {
    return this.update(id, userId, { status });
  }

  async delete(id: string, userId: string): Promise<ResumeStrategy> {
    const existing = await prisma.resumeStrategy.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new Error("Strategy not found or access denied");
    }

    return prisma.resumeStrategy.delete({
      where: { id },
    });
  }
}

export const strategyRepository = new StrategyRepository();
