import { ExtractedDocument, ErrorCode } from "@resumeai/shared";
import { AppError } from "../errors/index.js";

export interface ExtractionValidationResult {
  isValid: boolean;
  warnings: string[];
}

/**
 * Multi-signal Extraction Quality Validator.
 * Distinguishes VALID_SHORT_DOCUMENT from LIKELY_INCOMPLETE_EXTRACTION.
 * Detects IMAGE_ONLY_DOCUMENT (scanned documents) and rejects them cleanly.
 * Detects EXTRACTION_SUSPECTED_INCOMPLETE when later pages in a multi-page PDF fail to extract.
 */
export function validateExtraction(
  extracted: ExtractedDocument,
): ExtractionValidationResult {
  const warnings: string[] = [...extracted.warnings];

  // 1. Scanned / Image-only PDF detection
  if (extracted.isScannedOrImageOnly) {
    throw new AppError(
      400,
      ErrorCode.IMAGE_ONLY_DOCUMENT,
      "This PDF appears to be scanned or image-based and could not be read as text. OCR is not supported.",
    );
  }

  // 2. Empty document check
  if (extracted.totalWords === 0 || extracted.totalCharacters === 0) {
    throw new AppError(
      400,
      ErrorCode.BAD_REQUEST,
      "Uploaded document contains no extractable text. The file might be empty, corrupted, or image-only.",
    );
  }

  // 3. Multi-page document fidelity check (detect dropped later pages)
  if (extracted.actualPageCount > 1) {
    const page1 = extracted.pages[0];
    const laterPages = extracted.pages.slice(1);
    const emptyLaterPages = laterPages.filter((p) => p.wordCount === 0);

    // If page 1 has rich content but ALL later pages are completely empty
    if (
      page1 &&
      page1.wordCount > 50 &&
      emptyLaterPages.length === laterPages.length
    ) {
      throw new AppError(
        400,
        ErrorCode.EXTRACTION_SUSPECTED_INCOMPLETE,
        "Extraction incomplete: Later pages of this document could not be read. Please try another PDF or upload the original DOCX.",
      );
    }

    // If some later pages are empty, add a diagnostic warning
    if (emptyLaterPages.length > 0) {
      warnings.push(
        `EXTRACTION_SUSPECTED_INCOMPLETE: ${emptyLaterPages.length} page(s) out of ${extracted.actualPageCount} yielded no text.`,
      );
    }
  }

  // 4. Short document evaluation (do NOT fail valid short resumes)
  if (extracted.totalWords < 15) {
    // Check for essential resume signals: email, phone, or standard resume sections
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(
      extracted.rawText,
    );
    const hasSection = /(experience|education|skills|projects|summary)/i.test(
      extracted.rawText,
    );

    if (!hasEmail && !hasSection) {
      throw new AppError(
        400,
        ErrorCode.BAD_REQUEST,
        "Extracted text is too short and does not appear to contain a valid resume. The file might be corrupted or unreadable.",
      );
    }
    // Valid short resume: keep going with a gentle warning
    warnings.push(
      "VALID_SHORT_DOCUMENT: Document is relatively brief but contains valid resume indicators.",
    );
  }

  return {
    isValid: true,
    warnings,
  };
}
