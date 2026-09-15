import { ExtractedDocument, ExtractedPage } from "@resumeai/shared";

export type { ExtractedDocument, ExtractedPage };

export interface DocumentExtractor {
  extractPdf(buffer: Buffer): Promise<ExtractedDocument>;
  extractDocx(buffer: Buffer): Promise<ExtractedDocument>;
}
