import {
  jobRepository,
  JobRepository,
} from "../repositories/job.repository.js";
import { resumeRepository } from "../repositories/resume.repository.js";
import { AppError } from "../errors/index.js";
import {
  CreateJobRequest,
  JobAnalysisSchema,
  JobAnalysis,
} from "@resumeai/shared";
import { normalizeJobDescription } from "../utils/job-normalizer.js";
import { validateAndSanitizeJobAnalysis } from "../utils/job-validator.js";
import { getAIProvider } from "../ai/providers/index.js";
import {
  JOB_ANALYZER_SYSTEM_PROMPT,
  buildJobAnalyzerUserPrompt,
} from "../ai/prompts/job-analyzer.prompt.js";
import { logger } from "../utils/logger.js";

export class JobService {
  constructor(private jobRepo: JobRepository = jobRepository) {}

  async listJobs(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const { items, total } = await this.jobRepo.listByUserId(
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

  async getJob(id: string, userId: string) {
    const job = await this.jobRepo.findByIdAndUserId(id, userId);
    if (!job) {
      throw AppError.notFound("Job description");
    }
    return job;
  }

  async createJob(userId: string, data: CreateJobRequest) {
    // 1. Normalize and validate character limits
    const { normalizedText, charCount, wordCount } = normalizeJobDescription(
      data.rawText,
    );

    // 2. Validate linked resume ownership if resumeId is provided
    if (data.resumeId) {
      const resume = await resumeRepository.findByIdAndUserId(
        data.resumeId,
        userId,
      );
      if (!resume) {
        throw AppError.notFound("Resume to link");
      }
    }

    const shouldAnalyze = data.autoAnalyze !== false;

    // 3. Create job record
    const job = await this.jobRepo.create({
      userId,
      title: data.title?.trim() || "Untitled Position",
      company: data.company?.trim() || null,
      rawText: data.rawText,
      normalizedText,
      url: data.url || undefined,
      resumeId: data.resumeId || undefined,
      status: shouldAnalyze ? "ANALYZING" : "PENDING",
    });

    logger.info("Job description created", {
      jobId: job.id,
      userId,
      charCount,
      wordCount,
      autoAnalyze: shouldAnalyze,
    });

    // 4. Perform analysis synchronously if requested
    if (shouldAnalyze) {
      return this.executeAnalysis(
        job.id,
        normalizedText,
        data.title?.trim(),
        data.company?.trim(),
      );
    }

    return job;
  }

  async analyzeJob(id: string, userId: string) {
    const job = await this.jobRepo.findByIdAndUserId(id, userId);
    if (!job) {
      throw AppError.notFound("Job description");
    }

    // Ensure normalized text is available
    const normalized =
      job.normalizedText || normalizeJobDescription(job.rawText).normalizedText;

    return this.executeAnalysis(job.id, normalized, job.title, job.company);
  }

  private async executeAnalysis(
    jobId: string,
    normalizedText: string,
    existingTitle?: string | null,
    existingCompany?: string | null,
  ) {
    const startTime = Date.now();

    try {
      // 1. Update status to ANALYZING
      await this.jobRepo.updateAnalysis(jobId, "ANALYZING");

      // 2. Call AI provider with prompt injection defense
      const provider = getAIProvider();
      const prompt = buildJobAnalyzerUserPrompt(normalizedText);

      const result = await provider.generateStructuredOutput({
        prompt,
        systemPrompt: JOB_ANALYZER_SYSTEM_PROMPT,
        schema: JobAnalysisSchema,
        schemaName: "JobAnalysisSchema",
        temperature: 0.1,
        maxTokens: 6000,
      });

      // 3. Update status to VALIDATING
      await this.jobRepo.updateAnalysis(jobId, "VALIDATING");

      // 4. Deterministic validation & sanitization
      const validatedAnalysis: JobAnalysis = validateAndSanitizeJobAnalysis(
        result.data,
        normalizedText,
      );

      // Resolve title: prioritize user-supplied title, then AI extracted title, then fallback
      const resolvedTitle =
        existingTitle && existingTitle !== "Untitled Position"
          ? existingTitle
          : validatedAnalysis.jobTitle || existingTitle || "Untitled Position";

      // Resolve company: prioritize user-supplied company, then AI extracted company, then null
      const resolvedCompany =
        existingCompany || validatedAnalysis.company || null;

      const processingTimeMs = Date.now() - startTime;

      // 5. Update record with COMPLETED analysis
      const updatedJob = await this.jobRepo.updateAnalysis(jobId, "COMPLETED", {
        parsedData: validatedAnalysis as any,
        title: resolvedTitle,
        company: resolvedCompany,
        tokensUsed: result.totalTokens,
        processingTimeMs,
      });

      logger.info("Job description analysis completed", {
        jobId,
        processingTimeMs,
        tokensUsed: result.totalTokens,
        skillsExtracted: validatedAnalysis.skills.length,
        keywordsExtracted: validatedAnalysis.keywords.length,
      });

      return updatedJob;
    } catch (error: any) {
      const processingTimeMs = Date.now() - startTime;
      logger.error("Job description analysis failed", {
        jobId,
        error: error.message,
        processingTimeMs,
      });

      await this.jobRepo.updateAnalysis(jobId, "FAILED", {
        errorMessage: error.message || "Failed to analyze job description",
        processingTimeMs,
      });

      throw AppError.internal(
        `Failed to analyze job description: ${error.message || "Unknown error"}`,
      );
    }
  }

  async deleteJob(id: string, userId: string) {
    const deleted = await this.jobRepo.delete(id, userId);
    if (!deleted) {
      throw AppError.notFound("Job description");
    }
    return { success: true };
  }
}

export const jobService = new JobService();
