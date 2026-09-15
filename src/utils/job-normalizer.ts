import {
  MIN_JOB_DESCRIPTION_CHARS,
  MAX_JOB_DESCRIPTION_CHARS,
} from "@resumeai/shared";
import { AppError } from "../errors/index.js";

export interface NormalizedJobResult {
  normalizedText: string;
  wordCount: number;
  charCount: number;
}

/**
 * Normalizes raw job description text.
 * - Strips harmful control characters / null bytes
 * - Normalizes Windows/Mac line endings (\r\n, \r -> \n)
 * - Collapses redundant horizontal spacing
 * - Collapses 3+ consecutive newlines to double newlines
 * - Trims leading/trailing whitespace
 * - Enforces minimum (50) and maximum (30,000) character boundaries
 */
export function normalizeJobDescription(rawText: string): NormalizedJobResult {
  if (!rawText || typeof rawText !== "string") {
    throw AppError.badRequest("Job description text is required");
  }

  // 1. Strip harmful control characters while preserving valid newlines (\n) and tabs (\t)
  let text = rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // 2. Normalize linebreaks to \n
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 3. Normalize horizontal whitespace on each line
  const lines = text
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim());

  // 4. Recombine and collapse 3+ consecutive blank lines
  text = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // 5. Check character boundaries
  const charCount = text.length;
  if (charCount < MIN_JOB_DESCRIPTION_CHARS) {
    throw AppError.badRequest(
      `Job description text is too short (${charCount} chars). Minimum required is ${MIN_JOB_DESCRIPTION_CHARS} characters.`,
    );
  }

  if (charCount > MAX_JOB_DESCRIPTION_CHARS) {
    throw AppError.badRequest(
      `Job description text exceeds maximum limit (${charCount} chars). Maximum allowed is ${MAX_JOB_DESCRIPTION_CHARS} characters.`,
    );
  }

  // 6. Calculate word count
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  return {
    normalizedText: text,
    wordCount,
    charCount,
  };
}
