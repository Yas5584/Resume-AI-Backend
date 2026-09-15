import {
  ResumeDataSchema,
  JobAnalysisSchema,
  MatchAnalysis,
  ResumeStrategy,
  ResumeStrategySchema,
  RESUME_STRATEGY_VERSION,
  StrategyApprovalStatus,
} from "@resumeai/shared";
import { strategyRepository } from "../repositories/strategy.repository.js";
import { resumeRepository } from "../repositories/resume.repository.js";
import { jobRepository } from "../repositories/job.repository.js";
import { matchRepository } from "../repositories/match.repository.js";
import { calculateMatchAnalysis } from "../matching/index.js";
import { getAIProvider } from "../ai/providers/index.js";
import {
  RESUME_STRATEGY_SYSTEM_PROMPT,
  buildResumeStrategyUserPrompt,
} from "../ai/prompts/resume-strategy.prompt.js";
import { validateAndSanitizeStrategy } from "../utils/strategy-validator.js";
import { AppError } from "../errors/index.js";
import { logger } from "../utils/logger.js";

export class StrategyService {
  private strategyRepo = strategyRepository;
  private resumeRepo = resumeRepository;
  private jobRepo = jobRepository;
  private matchRepo = matchRepository;

  async createStrategy(
    userId: string,
    resumeId: string,
    jobId: string,
    matchId?: string,
  ) {
    const startTime = Date.now();

    // 1. Dual Ownership Enforcement
    const resume = await this.resumeRepo.findByIdAndUserId(resumeId, userId);
    if (!resume) {
      throw AppError.notFound("Resume");
    }

    const job = await this.jobRepo.findByIdAndUserId(jobId, userId);
    if (!job) {
      throw AppError.notFound("Job description");
    }

    // 2. Validate Job Analysis status
    if (job.status !== "COMPLETED" || !job.parsedData) {
      throw AppError.badRequest(
        "Job description must be analyzed before formulating strategy. Please analyze the job description first.",
      );
    }

    // 3. Validate structured inputs
    const parsedJobAnalysis = JobAnalysisSchema.safeParse(job.parsedData);
    if (!parsedJobAnalysis.success) {
      throw AppError.badRequest("Invalid job analysis structured data");
    }

    const parsedResumeData = ResumeDataSchema.safeParse(resume.resumeData);
    if (!parsedResumeData.success) {
      throw AppError.badRequest("Invalid resume structured data");
    }

    // 4. Resolve or calculate Match Analysis
    let matchRecord = null;
    let matchAnalysis: MatchAnalysis;

    if (matchId) {
      matchRecord = await this.matchRepo.findByIdAndUserId(matchId, userId);
      if (!matchRecord) {
        throw AppError.notFound("Match analysis");
      }
      matchAnalysis = matchRecord.analysisData as unknown as MatchAnalysis;
    } else {
      const existingMatch = await this.matchRepo.findByResumeAndJob(
        userId,
        resumeId,
        jobId,
      );
      if (existingMatch) {
        matchRecord = existingMatch;
        matchAnalysis = existingMatch.analysisData as unknown as MatchAnalysis;
      } else {
        matchAnalysis = calculateMatchAnalysis(
          parsedJobAnalysis.data,
          parsedResumeData.data,
          {
            resumeUpdatedAt: resume.updatedAt,
            jobUpdatedAt: job.updatedAt,
          },
        );
      }
    }

    // 5. Generate Strategy via AI Provider
    const provider = getAIProvider();
    const prompt = buildResumeStrategyUserPrompt(
      parsedResumeData.data,
      parsedJobAnalysis.data,
      matchAnalysis,
      {
        resumeId,
        jobId,
        matchId: matchRecord?.id,
      },
    );

    const aiResult = await provider.generateStructuredOutput({
      prompt,
      systemPrompt: RESUME_STRATEGY_SYSTEM_PROMPT,
      schema: ResumeStrategySchema,
      schemaName: "ResumeStrategySchema",
      temperature: 0.1,
      maxTokens: 8000,
    });

    // 6. Two-Stage Validation & Sanitization
    const validatedStrategy = validateAndSanitizeStrategy(
      aiResult.data,
      parsedResumeData.data,
      parsedJobAnalysis.data,
      matchAnalysis,
    );

    // Attach identifiers & snapshot timestamps
    validatedStrategy.resumeId = resumeId;
    validatedStrategy.jobId = jobId;
    validatedStrategy.matchId = matchRecord?.id || null;
    validatedStrategy.resumeUpdatedAt = resume.updatedAt.toISOString();
    validatedStrategy.jobUpdatedAt = job.updatedAt.toISOString();
    validatedStrategy.matchUpdatedAt =
      matchRecord?.updatedAt?.toISOString() || null;
    validatedStrategy.isStale = false;
    validatedStrategy.strategyVersion = RESUME_STRATEGY_VERSION;
    validatedStrategy.status = "DRAFT";

    // 7. Persist or Update Strategy
    const existingStrategy = await this.strategyRepo.findByResumeAndJob(
      userId,
      resumeId,
      jobId,
    );
    let savedStrategy;

    if (existingStrategy) {
      savedStrategy = await this.strategyRepo.update(
        existingStrategy.id,
        userId,
        {
          status: "DRAFT",
          strategyVersion: RESUME_STRATEGY_VERSION,
          resumeUpdatedAt: resume.updatedAt,
          jobUpdatedAt: job.updatedAt,
          matchUpdatedAt: matchRecord?.updatedAt,
          strategyData: validatedStrategy as any,
        },
      );
    } else {
      savedStrategy = await this.strategyRepo.create({
        userId,
        resumeId,
        jobId,
        matchId: matchRecord?.id,
        strategyVersion: RESUME_STRATEGY_VERSION,
        status: "DRAFT",
        resumeUpdatedAt: resume.updatedAt,
        jobUpdatedAt: job.updatedAt,
        matchUpdatedAt: matchRecord?.updatedAt,
        strategyData: validatedStrategy as any,
      });
    }

    const durationMs = Date.now() - startTime;

    logger.info("Resume strategy created successfully", {
      strategyId: savedStrategy.id,
      userId,
      resumeId,
      jobId,
      strategyVersion: RESUME_STRATEGY_VERSION,
      tokensUsed: aiResult.totalTokens,
      durationMs,
    });

    return {
      ...savedStrategy,
      isStale: false,
      strategyData: {
        ...(savedStrategy.strategyData as object),
        id: savedStrategy.id,
        isStale: false,
      },
    };
  }

  async getStrategy(id: string, userId: string) {
    const record = await this.strategyRepo.findByIdAndUserId(id, userId);
    if (!record) {
      throw AppError.notFound("Strategy");
    }

    // Check freshness against underlying resume, job, and match
    const resumeUpdated = record.resume?.updatedAt;
    const jobUpdated = record.job?.updatedAt;
    const matchUpdated = record.match?.updatedAt;

    let isStale = false;
    if (
      record.resumeUpdatedAt &&
      resumeUpdated &&
      new Date(resumeUpdated) > new Date(record.resumeUpdatedAt)
    ) {
      isStale = true;
    }
    if (
      record.jobUpdatedAt &&
      jobUpdated &&
      new Date(jobUpdated) > new Date(record.jobUpdatedAt)
    ) {
      isStale = true;
    }
    if (
      record.matchUpdatedAt &&
      matchUpdated &&
      new Date(matchUpdated) > new Date(record.matchUpdatedAt)
    ) {
      isStale = true;
    }

    const strategyData = record.strategyData as Record<string, any>;
    const enrichedData = {
      ...strategyData,
      id: record.id,
      status: record.status,
      isStale,
      resumeUpdatedAt: record.resumeUpdatedAt
        ? new Date(record.resumeUpdatedAt).toISOString()
        : null,
      jobUpdatedAt: record.jobUpdatedAt
        ? new Date(record.jobUpdatedAt).toISOString()
        : null,
      matchUpdatedAt: record.matchUpdatedAt
        ? new Date(record.matchUpdatedAt).toISOString()
        : null,
    };

    return {
      ...record,
      strategyData: enrichedData,
      isStale,
    };
  }

  async regenerateStrategy(id: string, userId: string) {
    const existing = await this.strategyRepo.findByIdAndUserId(id, userId);
    if (!existing) {
      throw AppError.notFound("Strategy");
    }

    return this.createStrategy(
      userId,
      existing.resumeId,
      existing.jobId,
      existing.matchId || undefined,
    );
  }

  async updateStatus(
    id: string,
    userId: string,
    status: StrategyApprovalStatus,
  ) {
    const existing = await this.strategyRepo.findByIdAndUserId(id, userId);
    if (!existing) {
      throw AppError.notFound("Strategy");
    }

    const updated = await this.strategyRepo.updateStatus(id, userId, status);
    const strategyData = updated.strategyData as Record<string, any>;

    return {
      ...updated,
      strategyData: {
        ...strategyData,
        id: updated.id,
        status: updated.status,
      },
    };
  }

  async listStrategies(userId: string, skip = 0, take = 20) {
    const { items, total } = await this.strategyRepo.listByUserId(
      userId,
      skip,
      take,
    );

    const enrichedItems = items.map((item) => {
      const resumeUpdated = item.resume?.updatedAt;
      const jobUpdated = item.job?.updatedAt;
      const matchUpdated = item.match?.updatedAt;

      let isStale = false;
      if (
        item.resumeUpdatedAt &&
        resumeUpdated &&
        new Date(resumeUpdated) > new Date(item.resumeUpdatedAt)
      ) {
        isStale = true;
      }
      if (
        item.jobUpdatedAt &&
        jobUpdated &&
        new Date(jobUpdated) > new Date(item.jobUpdatedAt)
      ) {
        isStale = true;
      }
      if (
        item.matchUpdatedAt &&
        matchUpdated &&
        new Date(matchUpdated) > new Date(item.matchUpdatedAt)
      ) {
        isStale = true;
      }

      return {
        ...item,
        isStale,
        strategyData: {
          ...(item.strategyData as object),
          id: item.id,
          status: item.status,
          isStale,
        },
      };
    });

    return { items: enrichedItems, total };
  }

  async deleteStrategy(id: string, userId: string) {
    const existing = await this.strategyRepo.findByIdAndUserId(id, userId);
    if (!existing) {
      throw AppError.notFound("Strategy");
    }
    return this.strategyRepo.delete(id, userId);
  }
}

export const strategyService = new StrategyService();
