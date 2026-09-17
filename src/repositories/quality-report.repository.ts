import {
  prisma,
  ResumeQualityReport,
  ResumeQualityReportStatus,
  Prisma,
} from "@resumeai/database";

export type QualityReportWithRelations = Prisma.ResumeQualityReportGetPayload<{
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
    resumeVersion: {
      select: {
        id: true;
        versionNumber: true;
        title: true;
        createdAt: true;
      };
    };
  };
}>;

export class QualityReportRepository {
  async findByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<QualityReportWithRelations | null> {
    return prisma.resumeQualityReport.findFirst({
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
        resumeVersion: {
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

  async findLatestByResumeId(
    resumeId: string,
    userId: string,
    jobId?: string,
  ): Promise<QualityReportWithRelations | null> {
    const whereClause: Prisma.ResumeQualityReportWhereInput = {
      resumeId,
      userId,
    };
    if (jobId) {
      whereClause.jobId = jobId;
    }

    return prisma.resumeQualityReport.findFirst({
      where: whereClause,
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
        resumeVersion: {
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

  async findCurrentByHash(
    resumeId: string,
    userId: string,
    contentHash: string,
    jobHash?: string | null,
  ): Promise<QualityReportWithRelations | null> {
    const whereClause: Prisma.ResumeQualityReportWhereInput = {
      resumeId,
      userId,
      contentHash,
      status: ResumeQualityReportStatus.CURRENT,
    };

    if (jobHash !== undefined) {
      whereClause.jobHash = jobHash;
    }

    return prisma.resumeQualityReport.findFirst({
      where: whereClause,
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
        resumeVersion: {
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

  async create(
    data: Prisma.ResumeQualityReportUncheckedCreateInput,
  ): Promise<ResumeQualityReport> {
    return prisma.resumeQualityReport.create({
      data,
    });
  }

  async markStaleForResume(resumeId: string): Promise<number> {
    const result = await prisma.resumeQualityReport.updateMany({
      where: {
        resumeId,
        status: ResumeQualityReportStatus.CURRENT,
      },
      data: {
        status: ResumeQualityReportStatus.STALE,
      },
    });
    return result.count;
  }

  async updateStatus(
    id: string,
    status: ResumeQualityReportStatus,
  ): Promise<ResumeQualityReport> {
    return prisma.resumeQualityReport.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const report = await prisma.resumeQualityReport.findFirst({
      where: { id, userId },
    });
    if (!report) return false;

    await prisma.resumeQualityReport.delete({
      where: { id },
    });
    return true;
  }

  async deleteByResumeId(resumeId: string, userId: string): Promise<number> {
    const result = await prisma.resumeQualityReport.deleteMany({
      where: { resumeId, userId },
    });
    return result.count;
  }
}

export const qualityReportRepository = new QualityReportRepository();
