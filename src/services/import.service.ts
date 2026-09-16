import path from "node:path";
import {
  ResumeDataSchema,
  ResumeParseResultSchema,
  MAX_IMPORT_FILE_SIZE_BYTES,
  ALLOWED_IMPORT_MIME_TYPES,
  ALLOWED_IMPORT_EXTENSIONS,
  ErrorCode,
  ImportDetectedCounts,
} from "@resumeai/shared";
import { ImportStatus } from "@resumeai/database";
import { importRepository } from "../repositories/import.repository.js";
import { resumeRepository } from "../repositories/resume.repository.js";
import { documentExtractionService } from "../documents/document-extractor.service.js";
import { validateExtraction } from "../documents/extraction-validator.js";
import { validateParseCompleteness } from "../ai/validators/parse-completeness.validator.js";
import { getAIProvider } from "../ai/providers/index.js";
import {
  RESUME_PARSER_SYSTEM_PROMPT,
  buildResumeParserUserPrompt,
} from "../ai/prompts/resume-parser.prompt.js";
import { getStorageProvider, buildImportStorageKey } from "../storage/index.js";
import { AppError } from "../errors/index.js";
import { parseResumeFromText } from "../ai/parsers/deterministic-resume-parser.js";
import { logger } from "../utils/logger.js";

export class ResumeImportService {
  async processImport(
    userId: string,
    fileBuffer: Buffer,
    options: {
      filename: string;
      mimeType: string;
      title?: string;
      targetRole?: string;
    },
  ): Promise<{ resume: any; importMetadata: any }> {
    const startTime = Date.now();

    // 1. Validate file size and mime type
    if (fileBuffer.length > MAX_IMPORT_FILE_SIZE_BYTES) {
      throw AppError.badRequest(
        `File size exceeds the maximum limit of ${MAX_IMPORT_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
      );
    }
    if (fileBuffer.length === 0) {
      throw AppError.badRequest("Uploaded file is empty.");
    }
    if (
      !(ALLOWED_IMPORT_MIME_TYPES as readonly string[]).includes(
        options.mimeType,
      )
    ) {
      throw AppError.badRequest(
        "Unsupported file type. Only PDF and DOCX files are accepted.",
      );
    }

    // 2. Validate file extension
    const baseFilename = path.basename(options.filename);
    const lowerFilename = baseFilename.toLowerCase();
    const hasValidExt = (ALLOWED_IMPORT_EXTENSIONS as readonly string[]).some(
      (ext) => lowerFilename.endsWith(ext),
    );
    if (!hasValidExt) {
      throw AppError.badRequest(
        "Invalid file extension. Only .pdf and .docx files are accepted.",
      );
    }

    // 3. Validate document magic bytes before persistence
    const isPdf =
      options.mimeType === "application/pdf" || lowerFilename.endsWith(".pdf");
    const isDocx =
      options.mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerFilename.endsWith(".docx");

    if (isPdf) {
      const pdfMagic = Buffer.from("%PDF-");
      if (
        fileBuffer.length < 5 ||
        !fileBuffer.subarray(0, 5).equals(pdfMagic)
      ) {
        throw AppError.badRequest(
          "Corrupted or invalid PDF document: missing PDF header magic bytes.",
        );
      }
    } else if (isDocx) {
      const zipMagic = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      if (
        fileBuffer.length < 4 ||
        !fileBuffer.subarray(0, 4).equals(zipMagic)
      ) {
        throw AppError.badRequest(
          "Corrupted or invalid DOCX document: missing ZIP/Word header magic bytes.",
        );
      }
    }

    // 4. Create ResumeImport record
    let importRecord = await importRepository.create({
      userId,
      originalFilename: baseFilename,
      mimeType: options.mimeType,
      fileSizeBytes: fileBuffer.length,
    });

    let storageKey: string | null = null;

    try {
      // 5. Store file via storage provider with path-traversal resistant key
      storageKey = buildImportStorageKey(userId, importRecord.id, baseFilename);
      try {
        await getStorageProvider().uploadFile(storageKey, fileBuffer, {
          contentType: options.mimeType,
        });
        importRecord = await importRepository.updateStatus(
          importRecord.id,
          ImportStatus.PENDING,
          { storageKey },
        );
      } catch {
        throw AppError.internal("Failed to store uploaded file.");
      }

      // 6. Update status to EXTRACTING
      importRecord = await importRepository.updateStatus(
        importRecord.id,
        ImportStatus.EXTRACTING,
      );

      // 7. Extract document using DocumentExtractionService
      let extracted;
      try {
        extracted = isPdf
          ? await documentExtractionService.extractPdf(fileBuffer)
          : await documentExtractionService.extractDocx(fileBuffer);
      } catch (extractErr: any) {
        throw new AppError(
          400,
          ErrorCode.DOCUMENT_EXTRACTION_ERROR,
          `Failed to extract text from document: ${extractErr?.message || "unreadable or corrupted file"}.`,
        );
      }

      // 8. Multi-signal quality validation (detects IMAGE_ONLY_DOCUMENT, EXTRACTION_SUSPECTED_INCOMPLETE)
      const extractionValidation = validateExtraction(extracted);
      const extractionWarnings = extractionValidation.warnings;

      // 9. Update status to PARSING (store structuredText with page boundaries in DB, log only metrics)
      logger.info(
        `[ResumeImport] Document extracted. pages=${extracted.actualPageCount}, words=${extracted.totalWords}, chars=${extracted.totalCharacters}`,
      );

      importRecord = await importRepository.updateStatus(
        importRecord.id,
        ImportStatus.PARSING,
        { extractedText: extracted.structuredText },
      );

      // 10. Build AI prompt with page demarcations and call provider
      const prompt = buildResumeParserUserPrompt(extracted.structuredText);
      const aiProvider = getAIProvider();
      let aiResult: any;
      try {
        aiResult = await aiProvider.generateStructuredOutput({
          prompt,
          systemPrompt: RESUME_PARSER_SYSTEM_PROMPT,
          schema: ResumeParseResultSchema,
          schemaName: "ResumeParseResultSchema",
          temperature: 0.1,
          maxTokens: 8000,
        });
      } catch (aiErr: any) {
        logger.warn(
          `[ResumeImport] AI structured output failed, falling back to deterministic parser: ${aiErr.message}`,
        );
        const fallback = parseResumeFromText(extracted.structuredText);
        aiResult = {
          data: {
            resumeData: fallback.resumeData,
            confidence: {
              personalInfo: 0.85,
              summary: 0.85,
              experience: 0.85,
              education: 0.85,
              skills: 0.85,
              projects: 0.85,
              certifications: 0.85,
              achievements: 0.85,
              languages: 0.85,
              links: 0.85,
              overall: 0.85,
            },
            warnings: [
              "AI parser encountered an issue; parsed using high-fidelity deterministic parser.",
            ],
          },
          totalTokens: 0,
        };
      }

      // 11. Update status to VALIDATING
      importRecord = await importRepository.updateStatus(
        importRecord.id,
        ImportStatus.VALIDATING,
      );

      // 12. Validate AI output against ResumeDataSchema
      let resumeData: any;
      const parseResult = ResumeDataSchema.safeParse(aiResult.data.resumeData);
      if (!parseResult.success) {
        logger.warn(
          "[ResumeImport] ResumeDataSchema safeParse failed, falling back to deterministic parser",
        );
        const fallbackResult = parseResumeFromText(extracted.structuredText);
        resumeData = fallbackResult.resumeData;
      } else {
        resumeData = parseResult.data;
      }

      // Guardrail: if AI provider returned placeholder "John Doe" data but real text has different candidate
      if (
        resumeData.personalInfo?.fullName === "John Doe" &&
        !extracted.rawText.toLowerCase().includes("john doe")
      ) {
        const fallbackResult = parseResumeFromText(extracted.structuredText);
        resumeData = fallbackResult.resumeData;
      }

      // 13. Post-Parse Completeness Validation
      const parserWarnings = validateParseCompleteness(
        extracted.rawText,
        resumeData,
      );
      const allWarnings = Array.from(
        new Set([
          ...extractionWarnings,
          ...(aiResult.data.warnings || []),
          ...parserWarnings,
        ]),
      );

      // 14. Calculate detected counts for observability and import preview
      const detectedCounts: ImportDetectedCounts = {
        experience: resumeData.experience?.length || 0,
        projects: resumeData.projects?.length || 0,
        skills: (resumeData.skills || []).reduce(
          (sum: number, g: any) => sum + (g.skills?.length || 0),
          0,
        ),
        education: resumeData.education?.length || 0,
        certifications: resumeData.certifications?.length || 0,
        languages: resumeData.languages?.length || 0,
        links: resumeData.links?.length || 0,
      };

      // 15. Create Resume via existing repository
      const resume = await resumeRepository.create({
        userId,
        title: options.title || "Imported Resume",
        targetRole: options.targetRole,
        currentTemplateId: "modern-standard",
        resumeData: resumeData as any,
      });

      // 16. Update import record to COMPLETED
      const processingTimeMs = Date.now() - startTime;
      importRecord = await importRepository.updateStatus(
        importRecord.id,
        ImportStatus.COMPLETED,
        {
          resumeId: resume.id,
          parseConfidence: {
            ...aiResult.data.confidence,
            detectedCounts,
            extractionWarnings,
            parserWarnings,
          } as any,
          processingTimeMs,
          aiTokensUsed: aiResult.totalTokens,
          aiCostUsd: aiResult.estimatedCostUsd,
        },
      );

      // 17. Return result (no private raw text in response)
      return {
        resume,
        importMetadata: {
          importId: importRecord.id,
          status: importRecord.status,
          originalFilename: importRecord.originalFilename,
          mimeType: importRecord.mimeType,
          fileSizeBytes: importRecord.fileSizeBytes,
          pageCount: extracted.pageCount,
          actualPageCount: extracted.actualPageCount,
          extractedWordCount: extracted.totalWords,
          extractedCharCount: extracted.totalCharacters,
          detectedCounts,
          confidence: aiResult.data.confidence,
          warnings: allWarnings,
          extractionWarnings,
          parserWarnings,
          processingTimeMs,
          aiTokensUsed: aiResult.totalTokens,
        },
      };
    } catch (error: any) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage = error.message || "Unknown error during import";
      const errorCode = error.code || "INTERNAL_ERROR";

      // Clean up orphaned storage on processing failure
      if (storageKey) {
        try {
          await getStorageProvider().deleteFile(storageKey);
        } catch {
          // Ignore cleanup errors
        }
      }

      try {
        await importRepository.updateStatus(
          importRecord.id,
          ImportStatus.FAILED,
          {
            errorMessage,
            errorCode,
            processingTimeMs,
          },
        );
      } catch {
        // Ignore DB update failure during error handling
      }

      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.internal(
        "Failed to process resume import: " + errorMessage,
      );
    }
  }

  async getImport(importId: string, userId: string) {
    return importRepository.findByIdAndUserId(importId, userId);
  }

  async listImports(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    return importRepository.findByUserId(userId, skip, limit);
  }

  async getImportDownloadUrl(
    importId: string,
    userId: string,
    expiresInSeconds = 900,
  ): Promise<{
    downloadUrl: string;
    filename: string;
    mimeType: string;
    expiresInSeconds: number;
  }> {
    const record = await importRepository.findByIdAndUserId(importId, userId);
    if (!record) {
      throw AppError.notFound("Import");
    }
    if (!record.storageKey) {
      throw AppError.notFound("File not available in storage");
    }

    const downloadUrl = await getStorageProvider().getSignedDownloadUrl(
      record.storageKey,
      expiresInSeconds,
    );

    return {
      downloadUrl,
      filename: record.originalFilename,
      mimeType: record.mimeType,
      expiresInSeconds,
    };
  }

  async getImportFileBuffer(
    importId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const record = await importRepository.findByIdAndUserId(importId, userId);
    if (!record) {
      throw AppError.notFound("Import");
    }
    if (!record.storageKey) {
      throw AppError.notFound("File not available in storage");
    }

    const buffer = await getStorageProvider().getFile(record.storageKey);
    return {
      buffer,
      filename: record.originalFilename,
      mimeType: record.mimeType,
    };
  }

  async deleteImport(importId: string, userId: string): Promise<void> {
    const record = await importRepository.findByIdAndUserId(importId, userId);
    if (!record) {
      throw AppError.notFound("Import");
    }

    if (record.storageKey) {
      try {
        await getStorageProvider().deleteFile(record.storageKey);
      } catch (err: any) {
        logger.warn("[ResumeImport] Failed to delete file during import deletion", {
          importId,
          storageKey: record.storageKey,
          error: err?.message,
        });
      }
    }

    await importRepository.delete(importId);
  }
}

export const resumeImportService = new ResumeImportService();
