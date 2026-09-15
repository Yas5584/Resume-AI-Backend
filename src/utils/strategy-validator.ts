import {
  ResumeData,
  JobAnalysis,
  MatchAnalysis,
  ResumeStrategy,
  ResumeStrategySchema,
  DEFAULT_PRESERVATION_RULES,
  DEFAULT_PROHIBITED_CHANGES,
  RESUME_STRATEGY_VERSION,
} from "@resumeai/shared";
import { AppError } from "../errors/index.js";

/**
 * Strategy Validator (Two-Stage Validation)
 *
 * Stage 1: Zod Schema Validation
 * Stage 2: Semantic Integrity Cross-Validation:
 *  - Verifies all referenced experience IDs genuinely exist in ResumeData
 *  - Verifies all referenced project IDs genuinely exist in ResumeData
 *  - Enforces missing-skill safety ("DO_NOT_CLAIM" invariant)
 *  - Ensures preservation rules and prohibited changes are populated
 *  - Validates numeric bounds and priorities
 */
export function validateAndSanitizeStrategy(
  rawStrategy: unknown,
  resumeData: ResumeData,
  jobAnalysis: JobAnalysis,
  matchAnalysis?: MatchAnalysis,
): ResumeStrategy {
  // Stage 1: Zod Schema Validation
  const parseResult = ResumeStrategySchema.safeParse(rawStrategy);
  if (!parseResult.success) {
    throw AppError.validation(
      "Strategy failed schema validation: " +
        parseResult.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
    );
  }

  const strategy = parseResult.data;

  // Stage 2: Semantic Integrity Validation
  const validExperienceIds = new Set(
    (resumeData.experience || []).map((e) => e.id),
  );
  const validProjectIds = new Set((resumeData.projects || []).map((p) => p.id));

  // 1. Verify experience references
  if (strategy.experienceStrategy?.items) {
    for (const expItem of strategy.experienceStrategy.items) {
      if (
        validExperienceIds.size > 0 &&
        !validExperienceIds.has(expItem.experienceId)
      ) {
        throw AppError.validation(
          `Experience strategy references non-existent experience ID: ${expItem.experienceId}`,
        );
      }
      if (expItem.priority < 1 || expItem.priority > 5) {
        throw AppError.validation(
          `Experience priority for ${expItem.experienceId} must be between 1 and 5`,
        );
      }
    }
  }

  // 2. Verify project references
  if (strategy.projectStrategy?.items) {
    for (const projItem of strategy.projectStrategy.items) {
      if (
        validProjectIds.size > 0 &&
        !validProjectIds.has(projItem.projectId)
      ) {
        throw AppError.validation(
          `Project strategy references non-existent project ID: ${projItem.projectId}`,
        );
      }
      if (projItem.priority < 1 || projItem.priority > 5) {
        throw AppError.validation(
          `Project priority for ${projItem.projectId} must be between 1 and 5`,
        );
      }
    }
  }

  // 3. Enforce Missing Skill Safety Invariant: Action MUST be "DO_NOT_CLAIM"
  if (strategy.skillStrategy?.missing) {
    for (const missing of strategy.skillStrategy.missing) {
      if (missing.action !== "DO_NOT_CLAIM") {
        throw AppError.validation(
          `Missing skill "${missing.skill}" has illegal action "${missing.action}". Must be "DO_NOT_CLAIM".`,
        );
      }
    }
  }

  // 4. Validate Section Priorities
  if (strategy.sectionStrategies) {
    for (const sec of strategy.sectionStrategies) {
      if (
        typeof sec.priority === "number" &&
        (sec.priority < 1 || sec.priority > 5)
      ) {
        throw AppError.validation(
          `Section strategy for ${sec.section} has invalid priority ${sec.priority}. Must be between 1 and 5.`,
        );
      }
    }
  }

  // 5. Ensure Preservation Rules and Prohibited Changes are active
  if (!strategy.preservationRules || strategy.preservationRules.length === 0) {
    strategy.preservationRules = DEFAULT_PRESERVATION_RULES;
  }
  if (!strategy.prohibitedChanges || strategy.prohibitedChanges.length === 0) {
    strategy.prohibitedChanges = DEFAULT_PROHIBITED_CHANGES;
  }

  // 6. Enforce Strategy Version
  strategy.strategyVersion = RESUME_STRATEGY_VERSION;

  return strategy;
}
