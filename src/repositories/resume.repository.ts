import { prisma, Resume, ResumeVersion, Prisma } from "@resumeai/database";

export class ResumeRepository {
  /**
   * Strictly enforces userId ownership check.
   */
  async findByIdAndUserId(id: string, userId: string): Promise<Resume | null> {
    return prisma.resume.findFirst({
      where: { id, userId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 5,
        },
      },
    });
  }

  async listByUserId(
    userId: string,
    skip = 0,
    take = 20,
  ): Promise<{ items: Resume[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.resume.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        skip,
        take,
      }),
      prisma.resume.count({
        where: { userId },
      }),
    ]);

    return { items, total };
  }

  async create(data: {
    userId: string;
    title: string;
    targetRole?: string;
    currentTemplateId?: string;
    resumeData: Prisma.InputJsonValue;
    templateConfig?: Prisma.InputJsonValue;
  }): Promise<Resume> {
    return prisma.resume.create({
      data: {
        userId: data.userId,
        title: data.title,
        targetRole: data.targetRole,
        currentTemplateId: data.currentTemplateId ?? "modern",
        resumeData: data.resumeData,
        templateConfig: data.templateConfig,
        versions: {
          create: {
            versionNumber: 1,
            title: "Initial Version",
            resumeData: data.resumeData,
            templateConfig: data.templateConfig,
            changeSummary: "Initial creation",
          },
        },
      },
    });
  }

  async update(
    id: string,
    userId: string,
    data: {
      title?: string;
      targetRole?: string;
      currentTemplateId?: string;
      resumeData?: Prisma.InputJsonValue;
      templateConfig?: Prisma.InputJsonValue;
      changeSummary?: string;
      createVersion?: boolean;
    },
  ): Promise<Resume | null> {
    // Verify ownership first
    const existing = await this.findByIdAndUserId(id, userId);
    if (!existing) return null;

    return prisma.$transaction(async (tx) => {
      // Only create a version row if explicitly requested or if changeSummary was provided
      if (data.createVersion || (data.changeSummary && data.resumeData)) {
        let nextVersionNumber = 1;
        const latestVersion = await tx.resumeVersion.findFirst({
          where: { resumeId: id },
          orderBy: { versionNumber: "desc" },
        });

        if (latestVersion) {
          nextVersionNumber = latestVersion.versionNumber + 1;
        }

        await tx.resumeVersion.create({
          data: {
            resumeId: id,
            versionNumber: nextVersionNumber,
            title: data.title ?? existing.title,
            resumeData: (data.resumeData ??
              existing.resumeData) as Prisma.InputJsonValue,
            templateConfig: (data.templateConfig !== undefined
              ? data.templateConfig
              : existing.templateConfig) as Prisma.InputJsonValue,
            changeSummary: data.changeSummary ?? `Version ${nextVersionNumber}`,
          },
        });
      }

      return tx.resume.update({
        where: { id },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.targetRole !== undefined
            ? { targetRole: data.targetRole }
            : {}),
          ...(data.currentTemplateId !== undefined
            ? { currentTemplateId: data.currentTemplateId }
            : {}),
          ...(data.resumeData !== undefined
            ? { resumeData: data.resumeData }
            : {}),
          ...(data.templateConfig !== undefined
            ? { templateConfig: data.templateConfig }
            : {}),
        },
      });
    });
  }

  async duplicate(
    id: string,
    userId: string,
    newTitle?: string,
  ): Promise<Resume | null> {
    const existing = await this.findByIdAndUserId(id, userId);
    if (!existing) return null;

    const title = newTitle || `${existing.title} (Copy)`;

    return prisma.resume.create({
      data: {
        userId,
        title,
        targetRole: existing.targetRole,
        currentTemplateId: existing.currentTemplateId,
        resumeData: existing.resumeData as Prisma.InputJsonValue,
        templateConfig: existing.templateConfig as Prisma.InputJsonValue,
        versions: {
          create: {
            versionNumber: 1,
            title: "Initial Copy",
            resumeData: existing.resumeData as Prisma.InputJsonValue,
            templateConfig: existing.templateConfig as Prisma.InputJsonValue,
            changeSummary: `Duplicated from "${existing.title}"`,
          },
        },
      },
    });
  }

  async listVersions(
    resumeId: string,
    userId: string,
  ): Promise<ResumeVersion[]> {
    const resume = await this.findByIdAndUserId(resumeId, userId);
    if (!resume) return [];

    return prisma.resumeVersion.findMany({
      where: { resumeId },
      orderBy: { versionNumber: "desc" },
    });
  }

  async createVersion(
    resumeId: string,
    userId: string,
    changeSummary?: string,
  ): Promise<ResumeVersion | null> {
    const resume = await this.findByIdAndUserId(resumeId, userId);
    if (!resume) return null;

    return prisma.$transaction(async (tx) => {
      let nextVersionNumber = 1;
      const latestVersion = await tx.resumeVersion.findFirst({
        where: { resumeId },
        orderBy: { versionNumber: "desc" },
      });

      if (latestVersion) {
        nextVersionNumber = latestVersion.versionNumber + 1;
      }

      return tx.resumeVersion.create({
        data: {
          resumeId,
          versionNumber: nextVersionNumber,
          title: resume.title,
          resumeData: resume.resumeData as Prisma.InputJsonValue,
          templateConfig: resume.templateConfig as Prisma.InputJsonValue,
          changeSummary: changeSummary ?? `Version ${nextVersionNumber}`,
        },
      });
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await this.findByIdAndUserId(id, userId);
    if (!existing) return false;

    await prisma.resume.delete({
      where: { id },
    });
    return true;
  }

  async getVersion(
    resumeId: string,
    versionNumber: number,
    userId: string,
  ): Promise<ResumeVersion | null> {
    const resume = await this.findByIdAndUserId(resumeId, userId);
    if (!resume) return null;

    return prisma.resumeVersion.findUnique({
      where: {
        resumeId_versionNumber: {
          resumeId,
          versionNumber,
        },
      },
    });
  }
}

export const resumeRepository = new ResumeRepository();
