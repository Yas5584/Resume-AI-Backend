import {
  resumeRepository,
  ResumeRepository,
} from "../repositories/resume.repository.js";
import { AppError } from "../errors/index.js";
import {
  CreateResumeRequest,
  UpdateResumeRequest,
  UpdateResumeDesignRequest,
  ResumeDataSchema,
  TemplateConfigSchema,
  getDefaultTemplateConfig,
  createDefaultResumeData,
} from "@resumeai/shared";

export class ResumeService {
  constructor(private resumeRepo: ResumeRepository = resumeRepository) {}

  async listResumes(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const { items, total } = await this.resumeRepo.listByUserId(
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

  async getResume(id: string, userId: string) {
    const resume = await this.resumeRepo.findByIdAndUserId(id, userId);
    if (!resume) {
      throw AppError.notFound("Resume");
    }
    return resume;
  }

  async createResume(userId: string, data: CreateResumeRequest) {
    const initialResumeData = data.initialData
      ? ResumeDataSchema.parse(data.initialData)
      : createDefaultResumeData();

    const templateConfig = data.templateConfig
      ? TemplateConfigSchema.parse(data.templateConfig)
      : getDefaultTemplateConfig(data.templateId);

    return this.resumeRepo.create({
      userId,
      title: data.title,
      targetRole: data.targetRole,
      currentTemplateId: data.templateId,
      resumeData: initialResumeData,
      templateConfig,
    });
  }

  async updateResume(id: string, userId: string, data: UpdateResumeRequest) {
    if (data.resumeData) {
      data.resumeData = ResumeDataSchema.parse(data.resumeData);
    }

    if (data.templateConfig) {
      data.templateConfig = TemplateConfigSchema.parse(data.templateConfig);
    }

    const updated = await this.resumeRepo.update(id, userId, {
      title: data.title,
      targetRole: data.targetRole,
      currentTemplateId: data.templateId,
      templateConfig: data.templateConfig,
      resumeData: data.resumeData,
      changeSummary: data.changeSummary,
      createVersion: data.createVersion,
    });

    if (!updated) {
      throw AppError.notFound("Resume");
    }

    return updated;
  }

  async updateResumeDesign(
    id: string,
    userId: string,
    data: UpdateResumeDesignRequest,
  ) {
    await this.getResume(id, userId);

    let validatedConfig = data.templateConfig;
    if (validatedConfig) {
      validatedConfig = TemplateConfigSchema.parse(validatedConfig);
    }

    const updated = await this.resumeRepo.update(id, userId, {
      currentTemplateId: data.templateId,
      templateConfig: validatedConfig,
    });

    if (!updated) {
      throw AppError.notFound("Resume");
    }

    return updated;
  }

  async duplicateResume(id: string, userId: string, newTitle?: string) {
    const duplicated = await this.resumeRepo.duplicate(id, userId, newTitle);
    if (!duplicated) {
      throw AppError.notFound("Resume");
    }
    return duplicated;
  }

  async deleteResume(id: string, userId: string) {
    const deleted = await this.resumeRepo.delete(id, userId);
    if (!deleted) {
      throw AppError.notFound("Resume");
    }
    return { success: true };
  }

  async listResumeVersions(resumeId: string, userId: string) {
    // Verify resume exists and user owns it
    await this.getResume(resumeId, userId);
    return this.resumeRepo.listVersions(resumeId, userId);
  }

  async createResumeVersion(
    resumeId: string,
    userId: string,
    changeSummary?: string,
  ) {
    // Verify resume exists and user owns it
    await this.getResume(resumeId, userId);
    const version = await this.resumeRepo.createVersion(
      resumeId,
      userId,
      changeSummary,
    );
    if (!version) {
      throw AppError.notFound("Resume");
    }
    return version;
  }

  async getResumeVersion(
    resumeId: string,
    versionNumber: number,
    userId: string,
  ) {
    const version = await this.resumeRepo.getVersion(
      resumeId,
      versionNumber,
      userId,
    );
    if (!version) {
      throw AppError.notFound(`Resume version ${versionNumber}`);
    }
    return version;
  }
}

export const resumeService = new ResumeService();
