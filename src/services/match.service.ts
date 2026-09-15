import {
  JobAnalysisSchema,
  ResumeDataSchema,
  MatchAnalysis,
  MATCH_SCORE_VERSION,
} from "@resumeai/shared";
import { matchRepository } from "../repositories/match.repository.js";
import { resumeRepository } from "../repositories/resume.repository.js";
import { jobRepository } from "../repositories/job.repository.js";
import { calculateMatchAnalysis } from "../matching/index.js";
import { AppError } from "../errors/index.js";
import { logger } from "../utils/logger.js";

export class MatchService {
  private matchRepo = matchRepository;
  private resumeRepo = resumeRepository;
  private jobRepo = jobRepository;

  async createMatch(userId: string, resumeId: string, jobId: string) {
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
        "Job description must be analyzed before computing a match. Please analyze the job description first.",
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

    // 4. Execute deterministic matching engine
    const matchAnalysis: MatchAnalysis = calculateMatchAnalysis(
      parsedJobAnalysis.data,
      parsedResumeData.data,
      {
        resumeUpdatedAt: resume.updatedAt,
        jobUpdatedAt: job.updatedAt,
      },
    );

    const durationMs = Date.now() - startTime;

    // 5. Persist or update Match record
    const existing = await this.matchRepo.findByResumeAndJob(
      userId,
      resumeId,
      jobId,
    );

    let matchRecord;
    if (existing) {
      matchRecord = await this.matchRepo.update(existing.id, userId, {
        matchScore: matchAnalysis.overallScore,
        scoreVersion: MATCH_SCORE_VERSION,
        resumeUpdatedAt: resume.updatedAt,
        jobUpdatedAt: job.updatedAt,
        analysisData: matchAnalysis as any,
      });
    } else {
      matchRecord = await this.matchRepo.create({
        userId,
        resumeId,
        jobId,
        matchScore: matchAnalysis.overallScore,
        scoreVersion: MATCH_SCORE_VERSION,
        resumeUpdatedAt: resume.updatedAt,
        jobUpdatedAt: job.updatedAt,
        analysisData: matchAnalysis as any,
      });
    }

    // Privacy-preserving observability (metadata only, no raw text)
    logger.info("Match analysis computed successfully", {
      matchId: matchRecord.id,
      resumeId,
      jobId,
      scoreVersion: MATCH_SCORE_VERSION,
      overallScore: matchAnalysis.overallScore,
      durationMs,
    });

    return {
      ...matchRecord,
      analysis: matchAnalysis,
      isStale: false,
    };
  }

  async getMatch(id: string, userId: string) {
    const match = await this.matchRepo.findByIdAndUserId(id, userId);
    if (!match) {
      throw AppError.notFound("Match analysis");
    }

    // Check if resume or job was modified after this match was calculated
    const resumeCurrentUpdated = (match.resume as any)?.updatedAt;
    const jobCurrentUpdated = (match.job as any)?.updatedAt;

    const isStale = Boolean(
      (match.resumeUpdatedAt &&
        resumeCurrentUpdated &&
        new Date(resumeCurrentUpdated).getTime() >
          new Date(match.resumeUpdatedAt).getTime()) ||
      (match.jobUpdatedAt &&
        jobCurrentUpdated &&
        new Date(jobCurrentUpdated).getTime() >
          new Date(match.jobUpdatedAt).getTime()),
    );

    const analysisData = (match.analysisData as any) || {};
    analysisData.isStale = isStale;

    return {
      ...match,
      analysis: analysisData,
      isStale,
    };
  }

  async listMatches(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const { items, total } = await this.matchRepo.listByUserId(
      userId,
      skip,
      limit,
    );

    const enrichedItems = items.map((m) => {
      const resumeCurrentUpdated = (m.resume as any)?.updatedAt;
      const jobCurrentUpdated = (m.job as any)?.updatedAt;

      const isStale = Boolean(
        (m.resumeUpdatedAt &&
          resumeCurrentUpdated &&
          new Date(resumeCurrentUpdated).getTime() >
            new Date(m.resumeUpdatedAt).getTime()) ||
        (m.jobUpdatedAt &&
          jobCurrentUpdated &&
          new Date(jobCurrentUpdated).getTime() >
            new Date(m.jobUpdatedAt).getTime()),
      );

      return {
        id: m.id,
        resumeId: m.resumeId,
        jobId: m.jobId,
        matchScore: m.matchScore,
        scoreVersion: m.scoreVersion,
        resumeTitle: (m.resume as any)?.title || "Untitled Resume",
        jobTitle: (m.job as any)?.title || "Untitled Position",
        jobCompany: (m.job as any)?.company || null,
        isStale,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      };
    });

    return {
      items: enrichedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteMatch(id: string, userId: string) {
    const existing = await this.matchRepo.findByIdAndUserId(id, userId);
    if (!existing) {
      throw AppError.notFound("Match analysis");
    }

    await this.matchRepo.delete(id, userId);
    return { success: true, id };
  }
}

export const matchService = new MatchService();
