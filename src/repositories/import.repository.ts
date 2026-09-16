import { prisma, ResumeImport, ImportStatus } from "@resumeai/database";

export class ImportRepository {
  async create(data: {
    userId: string;
    status?: ImportStatus;
    originalFilename: string;
    mimeType: string;
    fileSizeBytes: number;
    storageKey?: string;
  }): Promise<ResumeImport> {
    return prisma.resumeImport.create({
      data: {
        userId: data.userId,
        status: data.status ?? ImportStatus.PENDING,
        originalFilename: data.originalFilename,
        mimeType: data.mimeType,
        fileSizeBytes: data.fileSizeBytes,
        storageKey: data.storageKey,
      },
    });
  }

  async updateStatus(
    id: string,
    status: ImportStatus,
    updates?: {
      storageKey?: string;
      extractedText?: string;
      parseConfidence?: any;
      resumeId?: string;
      errorMessage?: string;
      errorCode?: string;
      processingTimeMs?: number;
      aiTokensUsed?: number;
      aiCostUsd?: number;
    },
  ): Promise<ResumeImport> {
    return prisma.resumeImport.update({
      where: { id },
      data: {
        status,
        ...(updates?.storageKey !== undefined && {
          storageKey: updates.storageKey,
        }),
        ...(updates?.extractedText !== undefined && {
          extractedText: updates.extractedText?.replace(/\0/g, ""),
        }),
        ...(updates?.parseConfidence !== undefined && {
          parseConfidence: updates.parseConfidence,
        }),
        ...(updates?.resumeId !== undefined && {
          resumeId: updates.resumeId,
        }),
        ...(updates?.errorMessage !== undefined && {
          errorMessage: updates.errorMessage?.replace(/\0/g, ""),
        }),
        ...(updates?.errorCode !== undefined && {
          errorCode: updates.errorCode,
        }),
        ...(updates?.processingTimeMs !== undefined && {
          processingTimeMs: updates.processingTimeMs,
        }),
        ...(updates?.aiTokensUsed !== undefined && {
          aiTokensUsed: updates.aiTokensUsed,
        }),
        ...(updates?.aiCostUsd !== undefined && {
          aiCostUsd: updates.aiCostUsd,
        }),
      },
    });
  }

  async findById(id: string): Promise<ResumeImport | null> {
    return prisma.resumeImport.findUnique({
      where: { id },
    });
  }

  async findByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<ResumeImport | null> {
    return prisma.resumeImport.findFirst({
      where: {
        id,
        userId,
      },
    });
  }

  async findByUserId(
    userId: string,
    skip?: number,
    take?: number,
  ): Promise<{ items: ResumeImport[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.resumeImport.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.resumeImport.count({
        where: { userId },
      }),
    ]);

    return { items, total };
  }

  async delete(id: string): Promise<ResumeImport> {
    return prisma.resumeImport.delete({
      where: { id },
    });
  }
}

export const importRepository = new ImportRepository();
