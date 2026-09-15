import { prisma, ResumeJobAnalysis, Prisma } from "@resumeai/database";

export type MatchWithRelations = Prisma.ResumeJobAnalysisGetPayload<{
  include: {
    resume: {
      select: {
        id: true;
        title: true;
        updatedAt: true;
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
  };
}>;

export class MatchRepository {
  async findByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<MatchWithRelations | null> {
    return prisma.resumeJobAnalysis.findFirst({
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
      },
    });
  }

  async findByResumeAndJob(
    userId: string,
    resumeId: string,
    jobId: string,
  ): Promise<ResumeJobAnalysis | null> {
    return prisma.resumeJobAnalysis.findFirst({
      where: { userId, resumeId, jobId },
      orderBy: { createdAt: "desc" },
    });
  }

  async listByUserId(
    userId: string,
    skip = 0,
    take = 20,
  ): Promise<{ items: MatchWithRelations[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.resumeJobAnalysis.findMany({
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
        },
      }),
      prisma.resumeJobAnalysis.count({
        where: { userId },
      }),
    ]);

    return { items, total };
  }

  async create(data: {
    userId: string;
    resumeId: string;
    jobId: string;
    matchScore: number;
    scoreVersion: string;
    resumeUpdatedAt?: Date | null;
    jobUpdatedAt?: Date | null;
    analysisData: Prisma.InputJsonValue;
  }): Promise<MatchWithRelations> {
    return prisma.resumeJobAnalysis.create({
      data: {
        userId: data.userId,
        resumeId: data.resumeId,
        jobId: data.jobId,
        matchScore: data.matchScore,
        scoreVersion: data.scoreVersion,
        resumeUpdatedAt: data.resumeUpdatedAt,
        jobUpdatedAt: data.jobUpdatedAt,
        analysisData: data.analysisData,
      },
      include: {
        resume: {
          select: {
            id: true,
            title: true,
            updatedAt: true,
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
      },
    });
  }

  async update(
    id: string,
    userId: string,
    data: {
      matchScore: number;
      scoreVersion: string;
      resumeUpdatedAt?: Date | null;
      jobUpdatedAt?: Date | null;
      analysisData: Prisma.InputJsonValue;
    },
  ): Promise<MatchWithRelations> {
    return prisma.resumeJobAnalysis.update({
      where: { id },
      data: {
        matchScore: data.matchScore,
        scoreVersion: data.scoreVersion,
        resumeUpdatedAt: data.resumeUpdatedAt,
        jobUpdatedAt: data.jobUpdatedAt,
        analysisData: data.analysisData,
      },
      include: {
        resume: {
          select: {
            id: true,
            title: true,
            updatedAt: true,
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
      },
    });
  }

  async delete(id: string, userId: string): Promise<ResumeJobAnalysis> {
    // First verify ownership
    const existing = await prisma.resumeJobAnalysis.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new Error("Match not found or access denied");
    }

    return prisma.resumeJobAnalysis.delete({
      where: { id },
    });
  }
}

export const matchRepository = new MatchRepository();
