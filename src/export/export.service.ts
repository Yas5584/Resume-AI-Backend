import {
  ResumeDataSchema,
  TemplateConfigSchema,
  getDefaultTemplateConfig,
} from "@resumeai/shared";
import { AppError } from "../errors/index.js";
import {
  ResumeRepository,
  resumeRepository,
} from "../repositories/resume.repository.js";
import { ExportResult, ResumeExporter } from "./exporter.interface.js";
import { getPdfExporter } from "./pdf-exporter.factory.js";
import { docxResumeExporter, DocxResumeExporter } from "./docx-exporter.js";

export class ResumeExportService {
  constructor(
    private resumeRepo: ResumeRepository = resumeRepository,
    private pdfExporter: ResumeExporter = getPdfExporter(),
    private docxExporter: DocxResumeExporter = docxResumeExporter,
  ) {}

  async exportPdf(id: string, userId: string): Promise<ExportResult> {
    const resume = await this.resumeRepo.findByIdAndUserId(id, userId);
    if (!resume) {
      throw AppError.notFound("Resume");
    }

    const resumeData = ResumeDataSchema.parse(resume.resumeData);
    const templateConfig = resume.templateConfig
      ? TemplateConfigSchema.parse(resume.templateConfig)
      : getDefaultTemplateConfig(resume.currentTemplateId);

    return this.pdfExporter.export(resumeData, templateConfig, resume.title);
  }

  async exportDocx(id: string, userId: string): Promise<ExportResult> {
    const resume = await this.resumeRepo.findByIdAndUserId(id, userId);
    if (!resume) {
      throw AppError.notFound("Resume");
    }

    const resumeData = ResumeDataSchema.parse(resume.resumeData);
    const templateConfig = resume.templateConfig
      ? TemplateConfigSchema.parse(resume.templateConfig)
      : getDefaultTemplateConfig(resume.currentTemplateId);

    return this.docxExporter.export(resumeData, templateConfig, resume.title);
  }
}

export const resumeExportService = new ResumeExportService();
