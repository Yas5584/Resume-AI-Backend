import {
  prisma,
  JobDescription,
  Prisma,
  JobAnalysisStatus,
} from "@resumeai/database";

export class JobRepository {
  async findByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<JobDescription | null> {
    return prisma.jobDescription.findFirst({
      where: { id, userId },
      include: {
        resume: {
          select: {
            id: true,
            title: true,
            currentTemplateId: true,
          },
        },
        jobAnalyses: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });
  }

  async listByUserId(
    userId: string,
    skip = 0,
    take = 20,
  ): Promise<{ items: JobDescription[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.jobDescription.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          resume: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
      prisma.jobDescription.count({
        where: { userId },
      }),
    ]);

    return { items, total };
  }

  async create(data: {
    userId: string;
    company?: string | null;
    title?: string;
    rawText: string;
    normalizedText?: string;
    url?: string;
    resumeId?: string;
    status?: JobAnalysisStatus;
    parsedData?: Prisma.InputJsonValue;
  }): Promise<JobDescription> {
    return prisma.jobDescription.create({
      data: {
        userId: data.userId,
        company: data.company || null,
        title: data.title || "Untitled Position",
        rawText: data.rawText,
        normalizedText: data.normalizedText,
        url: data.url,
        resumeId: data.resumeId,
        status: data.status || "PENDING",
        parsedData: data.parsedData,
      },
      include: {
        resume: {
          select: {
            id: true,
            title: true,
            currentTemplateId: true,
          },
        },
      },
    });
  }

  async updateAnalysis(
    id: string,
    status: JobAnalysisStatus,
    updates?: {
      parsedData?: Prisma.InputJsonValue;
      title?: string;
      company?: string | null;
      errorMessage?: string | null;
      tokensUsed?: number;
      processingTimeMs?: number;
    },
  ): Promise<JobDescription> {
    return prisma.jobDescription.update({
      where: { id },
      data: {
        status,
        ...updates,
      },
      include: {
        resume: {
          select: {
            id: true,
            title: true,
            currentTemplateId: true,
          },
        },
      },
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await this.findByIdAndUserId(id, userId);
    if (!existing) return false;

    await prisma.jobDescription.delete({
      where: { id },
    });
    return true;
  }
}

export const jobRepository = new JobRepository();
