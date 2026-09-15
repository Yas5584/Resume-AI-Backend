import { ResumeData, TemplateConfig } from "@resumeai/shared";

export interface ExportResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

export interface ResumeExporter {
  export(
    resumeData: ResumeData,
    templateConfig: TemplateConfig,
    title: string,
  ): Promise<ExportResult>;
}
