import {
  prisma,
  ContentProposal,
  ContentProposalStatus,
  Prisma,
} from "@resumeai/database";

export type ProposalWithRelations = Prisma.ContentProposalGetPayload<{
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
    strategy: {
      select: {
        id: true;
        status: true;
        updatedAt: true;
      };
    };
    appliedVersion: {
      select: {
        id: true;
        versionNumber: true;
        title: true;
        createdAt: true;
      };
    };
  };
}>;

export class ContentProposalRepository {
  async findById(id: string): Promise<ProposalWithRelations | null> {
    return prisma.contentProposal.findUnique({
      where: { id },
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
        strategy: {
          select: {
            id: true,
            status: true,
            updatedAt: true,
          },
        },
        appliedVersion: {
          select: {
            id: true,
            versionNumber: true,
            title: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async findByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<ProposalWithRelations | null> {
    return prisma.contentProposal.findFirst({
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
        strategy: {
          select: {
            id: true,
            status: true,
            updatedAt: true,
          },
        },
        appliedVersion: {
          select: {
            id: true,
            versionNumber: true,
            title: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async findByResumeAndJob(
    userId: string,
    resumeId: string,
    jobId: string,
  ): Promise<ProposalWithRelations | null> {
    return prisma.contentProposal.findFirst({
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
        strategy: {
          select: {
            id: true,
            status: true,
            updatedAt: true,
          },
        },
        appliedVersion: {
          select: {
            id: true,
            versionNumber: true,
            title: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async findByUserId(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: ProposalWithRelations[]; total: number }> {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.contentProposal.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
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
          strategy: {
            select: {
              id: true,
              status: true,
              updatedAt: true,
            },
          },
          appliedVersion: {
            select: {
              id: true,
              versionNumber: true,
              title: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.contentProposal.count({ where: { userId } }),
    ]);

    return { items, total };
  }

  async create(data: {
    userId: string;
    resumeId: string;
    jobId?: string | null;
    matchId?: string | null;
    strategyId?: string | null;
    status?: ContentProposalStatus;
    resumeUpdatedAt?: Date | null;
    jobUpdatedAt?: Date | null;
    matchUpdatedAt?: Date | null;
    strategyUpdatedAt?: Date | null;
    proposalData: Prisma.InputJsonValue;
  }): Promise<ContentProposal> {
    return prisma.contentProposal.create({
      data: {
        userId: data.userId,
        resumeId: data.resumeId,
        jobId: data.jobId,
        matchId: data.matchId,
        strategyId: data.strategyId,
        status: data.status || ContentProposalStatus.DRAFT,
        resumeUpdatedAt: data.resumeUpdatedAt,
        jobUpdatedAt: data.jobUpdatedAt,
        matchUpdatedAt: data.matchUpdatedAt,
        strategyUpdatedAt: data.strategyUpdatedAt,
        proposalData: data.proposalData,
      },
    });
  }

  async update(
    id: string,
    userId: string,
    data: {
      status?: ContentProposalStatus;
      proposalData?: Prisma.InputJsonValue;
      appliedVersionId?: string | null;
      resumeUpdatedAt?: Date | null;
      jobUpdatedAt?: Date | null;
      matchUpdatedAt?: Date | null;
      strategyUpdatedAt?: Date | null;
    },
  ): Promise<ContentProposal | null> {
    const existing = await this.findByIdAndUserId(id, userId);
    if (!existing) return null;

    return prisma.contentProposal.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.proposalData !== undefined
          ? { proposalData: data.proposalData }
          : {}),
        ...(data.appliedVersionId !== undefined
          ? { appliedVersionId: data.appliedVersionId }
          : {}),
        ...(data.resumeUpdatedAt !== undefined
          ? { resumeUpdatedAt: data.resumeUpdatedAt }
          : {}),
        ...(data.jobUpdatedAt !== undefined
          ? { jobUpdatedAt: data.jobUpdatedAt }
          : {}),
        ...(data.matchUpdatedAt !== undefined
          ? { matchUpdatedAt: data.matchUpdatedAt }
          : {}),
        ...(data.strategyUpdatedAt !== undefined
          ? { strategyUpdatedAt: data.strategyUpdatedAt }
          : {}),
      },
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await this.findByIdAndUserId(id, userId);
    if (!existing) return false;

    await prisma.contentProposal.delete({ where: { id } });
    return true;
  }
}

export const contentProposalRepository = new ContentProposalRepository();
