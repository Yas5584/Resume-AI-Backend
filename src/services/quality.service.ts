import crypto from "crypto";
import { prisma } from "@resumeai/database";
import {
  ResumeData,
  ResumeDataSchema,
  TemplateConfig,
  TemplateConfigSchema,
  JobAnalysis,
  JobAnalysisSchema,
  MatchAnalysis,
  ResumeQualityReport,
  ResumeQualityFinding,
  AnalyzeResumeQualityInput,
  JobMatchSummary,
  ResumeQualityReportStatus,
} from "@resumeai/shared";
import { resumeRepository } from "../repositories/resume.repository.js";
import { jobRepository } from "../repositories/job.repository.js";
import { matchRepository } from "../repositories/match.repository.js";
import {
  qualityReportRepository,
  QualityReportWithRelations,
} from "../repositories/quality-report.repository.js";
import { runAllDeterministicChecks } from "../quality/checks/index.js";
import { calculateQualityScore } from "../quality/scoring/scoring-engine.js";
import { ResumeQualityAgent } from "../ai/agents/resume-quality.agent.js";
import { getAIProvider } from "../ai/providers/index.js";
import { calculateMatchAnalysis } from "../matching/index.js";
import { AppError } from "../errors/index.js";
import { logger } from "../utils/logger.js";

/**
 * Computes a deterministic SHA-256 hash of structured resume content and presentation.
 */
export function computeResumeContentHash(
  resumeData: unknown,
  templateConfig?: unknown,
): string {
  const payload = JSON.stringify({
    data: resumeData,
    config: templateConfig || null,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Computes a deterministic SHA-256 hash of job analysis content.
 */
export function computeJobContentHash(jobParsedData: unknown): string {
  const payload = JSON.stringify(jobParsedData || {});
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export class QualityService {
  private resumeRepo = resumeRepository;
  private jobRepo = jobRepository;
  private matchRepo = matchRepository;
  private reportRepo = qualityReportRepository;

  /**
   * Generates a comprehensive, evidence-backed Resume Quality Report.
   * Deterministically calculates overall score and category scores without LLM score tampering.
   */
  async analyze(
    userId: string,
    resumeId: string,
    options?: AnalyzeResumeQualityInput,
  ): Promise<ResumeQualityReport> {
    const startTime = Date.now();

    // 1. Strict Ownership Enforcement
    const resume = await this.resumeRepo.findByIdAndUserId(resumeId, userId);
    if (!resume) {
      throw AppError.notFound("Resume");
    }

    const parsedResumeData = ResumeDataSchema.safeParse(resume.resumeData);
    if (!parsedResumeData.success) {
      throw AppError.badRequest("Invalid resume data schema");
    }
    const resumeData: ResumeData = parsedResumeData.data;

    let templateConfig: TemplateConfig | null = null;
    if (resume.templateConfig) {
      const parsedConfig = TemplateConfigSchema.safeParse(resume.templateConfig);
      if (parsedConfig.success) {
        templateConfig = parsedConfig.data;
      }
    }

    // Compute deterministic hashes
    const contentHash = computeResumeContentHash(resumeData, templateConfig);

    let jobRecord = null;
    let jobAnalysis: JobAnalysis | null = null;
    let jobHash: string | null = null;
    let matchAnalysis: MatchAnalysis | null = null;
    let jobMatchSummary: JobMatchSummary | null = null;

    if (options?.jobId) {
      jobRecord = await this.jobRepo.findByIdAndUserId(options.jobId, userId);
      if (!jobRecord) {
        throw AppError.notFound("Job description");
      }
      if (jobRecord.status === "COMPLETED" && jobRecord.parsedData) {
        const parsed = JobAnalysisSchema.safeParse(jobRecord.parsedData);
        if (parsed.success) {
          jobAnalysis = parsed.data;
          jobHash = computeJobContentHash(jobRecord.parsedData);
        }
      }

      // Resolve Match Analysis from Phase 7 (Do not create a duplicate matching engine)
      if (jobAnalysis) {
        let existingMatch = await this.matchRepo.findByResumeAndJob(
          userId,
          resumeId,
          jobRecord.id,
        );

        if (existingMatch && existingMatch.analysisData) {
          matchAnalysis = existingMatch.analysisData as unknown as MatchAnalysis;
        } else {
          // Compute transparent match using Phase 7 engine
          matchAnalysis = calculateMatchAnalysis(jobAnalysis, resumeData);
        }

        const missingSkillsList = (matchAnalysis.missingSkills || []).map(
          (s: any) => (typeof s === "string" ? s : s.skill || s.name || String(s)),
        );
        const missingReqsList = (matchAnalysis.missingRequirements || []).map(
          (r: any) => (typeof r === "string" ? r : r.text || r.requirementText || String(r)),
        );

        jobMatchSummary = {
          matchScore: matchAnalysis.overallScore,
          matchId: existingMatch?.id,
          jobId: jobRecord.id,
          jobTitle: jobRecord.title,
          company: jobRecord.company,
          missingKeywords: missingSkillsList.slice(0, 10),
          missingRequirements: missingReqsList.slice(0, 5),
        };
      }
    }

    // 2. Cache Check (Avoid redundant expensive AI analysis if identical content already analyzed)
    if (!options?.forceRefresh) {
      const existingCurrentReport = await this.reportRepo.findCurrentByHash(
        resumeId,
        userId,
        contentHash,
        jobHash,
      );

      if (existingCurrentReport) {
        // Verify resume hasn't been touched since (with 1-second tolerance for DB timestamp precision)
        const isStillFresh =
          new Date(resume.updatedAt).getTime() <=
          new Date(existingCurrentReport.resumeUpdatedAt).getTime() + 1000;

        if (isStillFresh) {
          logger.info("Serving cached quality report for fresh resume hash", {
            reportId: existingCurrentReport.id,
            resumeId,
            contentHash,
          });
          return this.formatReportResponse(existingCurrentReport, jobMatchSummary);
        }
      }
    }

    // 3. Deterministic Backend Checks
    const checksResult = runAllDeterministicChecks(resumeData, templateConfig);

    // 4. AI Qualitative Content Analysis (Prompt Injection Defended)
    const provider = getAIProvider();
    const agent = new ResumeQualityAgent(provider);

    const aiOutput = await agent.analyze({
      resumeData,
      deterministicFindings: checksResult.findings,
      jobAnalysis,
      matchAnalysis,
    });

    // Map AI findings safely with unique IDs
    const aiFindings: ResumeQualityFinding[] = (aiOutput.contentFindings || []).map(
      (f: any, idx: number) => ({
        id: `ai-finding-${idx + 1}-${Date.now()}`,
        category: f.category,
        severity: f.severity,
        title: f.title,
        description: f.description,
        whyItMatters: f.whyItMatters,
        recommendation: f.recommendation,
        section: f.section,
        itemId: f.itemId,
        field: f.field,
        evidence: f.evidence,
        confidence: f.confidence,
      }),
    );

    // 5. Deterministic Scoring Engine Calculation
    const scoringOutput = calculateQualityScore(checksResult, aiFindings);

    // Combine strengths (deterministic + AI qualitative)
    const combinedStrengths = Array.from(
      new Set([
        ...scoringOutput.strengths,
        ...(aiOutput.contentStrengths || []),
      ]),
    ).slice(0, 6);

    // 6. Persistence in Database
    // Mark previous reports for this resume as STALE
    await this.reportRepo.markStaleForResume(resumeId);

    // Find current version number if exists
    const latestVersion = await prisma.resumeVersion.findFirst({
      where: { resumeId },
      orderBy: { versionNumber: "desc" },
    });

    const processingTimeMs = Date.now() - startTime;

    const createdReport = await this.reportRepo.create({
      userId,
      resumeId,
      resumeVersionId: latestVersion?.id || null,
      jobId: jobRecord?.id || null,
      score: scoringOutput.overallScore,
      categoryScores: scoringOutput.categoryScores as any,
      findings: scoringOutput.allFindings as any,
      recommendations: aiOutput.actionableRecommendations as any,
      strengths: combinedStrengths as any,
      contentHash,
      jobHash,
      status: ResumeQualityReportStatus.CURRENT,
      resumeUpdatedAt: resume.updatedAt,
      analyzerVersion: "1.0",
      scoringVersion: "1.0",
      tokensUsed: 650, // Standard baseline tracking
      processingTimeMs,
    });

    logger.info("Generated new Resume Quality Report", {
      reportId: createdReport.id,
      resumeId,
      userId,
      score: scoringOutput.overallScore,
      processingTimeMs,
    });

    // Fetch complete relations and format
    const fullReport = await this.reportRepo.findByIdAndUserId(createdReport.id, userId);
    return this.formatReportResponse(fullReport || (createdReport as any), jobMatchSummary);
  }

  /**
   * Retrieves the latest Quality Report for a resume, checking for staleness.
   */
  async getLatest(
    userId: string,
    resumeId: string,
    jobId?: string,
  ): Promise<ResumeQualityReport | null> {
    const resume = await this.resumeRepo.findByIdAndUserId(resumeId, userId);
    if (!resume) {
      throw AppError.notFound("Resume");
    }

    const report = await this.reportRepo.findLatestByResumeId(
      resumeId,
      userId,
      jobId,
    );
    if (!report) {
      return null;
    }

    // Check if resume was modified after the report was generated
    let normalizedData = resume.resumeData;
    const parsedData = ResumeDataSchema.safeParse(resume.resumeData);
    if (parsedData.success) {
      normalizedData = parsedData.data;
    }

    let normalizedConfig: TemplateConfig | null = null;
    if (resume.templateConfig) {
      const parsedConfig = TemplateConfigSchema.safeParse(resume.templateConfig);
      if (parsedConfig.success) {
        normalizedConfig = parsedConfig.data;
      }
    }

    const currentHash = computeResumeContentHash(
      normalizedData,
      normalizedConfig,
    );
    const isStale =
      report.contentHash !== currentHash ||
      new Date(resume.updatedAt).getTime() >
        new Date(report.resumeUpdatedAt).getTime() + 1000;

    if (isStale && report.status === ResumeQualityReportStatus.CURRENT) {
      await this.reportRepo.updateStatus(report.id, ResumeQualityReportStatus.STALE);
      report.status = ResumeQualityReportStatus.STALE;
    }

    // Resolve job match summary if job is linked
    let jobMatchSummary: JobMatchSummary | null = null;
    if (report.jobId) {
      const match = await this.matchRepo.findByResumeAndJob(
        userId,
        resumeId,
        report.jobId,
      );
      if (match && match.analysisData) {
        const m = match.analysisData as unknown as MatchAnalysis;
        const missingSkillsList = (m.missingSkills || []).map(
          (s: any) => (typeof s === "string" ? s : s.skill || s.name || String(s)),
        );
        const missingReqsList = (m.missingRequirements || []).map(
          (r: any) => (typeof r === "string" ? r : r.text || r.requirementText || String(r)),
        );

        jobMatchSummary = {
          matchScore: m.overallScore,
          matchId: match.id,
          jobId: report.jobId,
          jobTitle: report.job?.title,
          company: report.job?.company,
          missingKeywords: missingSkillsList.slice(0, 10),
          missingRequirements: missingReqsList.slice(0, 5),
        };
      }
    }

    return this.formatReportResponse(report, jobMatchSummary);
  }

  /**
   * Deletes all quality reports for a resume.
   */
  async deleteByResumeId(userId: string, resumeId: string): Promise<boolean> {
    const resume = await this.resumeRepo.findByIdAndUserId(resumeId, userId);
    if (!resume) {
      throw AppError.notFound("Resume");
    }

    const count = await this.reportRepo.deleteByResumeId(resumeId, userId);
    return count > 0;
  }

  /**
   * Formats a database report record into a typed ResumeQualityReport object.
   */
  private formatReportResponse(
    report: QualityReportWithRelations | any,
    jobMatch?: JobMatchSummary | null,
  ): ResumeQualityReport {
    const score = report.score;
    let statusLabel: "Excellent" | "Good" | "Needs Improvement" | "Needs Attention" =
      "Good";
    if (score >= 90) statusLabel = "Excellent";
    else if (score >= 75) statusLabel = "Good";
    else if (score >= 60) statusLabel = "Needs Improvement";
    else statusLabel = "Needs Attention";

    let summaryText = "";
    if (score >= 90) {
      summaryText =
        "Excellent resume quality with strong ATS readiness and clear accomplishments.";
    } else if (score >= 75) {
      summaryText =
        "Solid foundation with good structure; addressing targeted recommendations will further strengthen ATS readability.";
    } else if (score >= 60) {
      summaryText =
        "Needs improvement in structure or detail to ensure seamless ATS parseability and recruiter impact.";
    } else {
      summaryText =
        "Needs attention: critical sections or essential details are missing or need substantial enhancement.";
    }

    const findings = (report.findings as ResumeQualityFinding[]) || [];
    const criticalIssuesCount = findings.filter(
      (f) => f.severity === "CRITICAL" || f.severity === "HIGH",
    ).length;

    return {
      id: report.id,
      resumeId: report.resumeId,
      resumeVersionId: report.resumeVersionId,
      jobId: report.jobId,
      overallScore: report.score,
      status: report.status as any,
      statusLabel,
      summary: summaryText,
      categories: report.categoryScores as any,
      strengths: (report.strengths as string[]) || [],
      criticalIssuesCount,
      findings,
      contentHash: report.contentHash,
      jobHash: report.jobHash,
      analyzedAt: report.createdAt.toISOString(),
      resumeUpdatedAt: report.resumeUpdatedAt.toISOString(),
      analyzerVersion: report.analyzerVersion || "1.0",
      scoringVersion: report.scoringVersion || "1.0",
      jobMatch,
    };
  }
}

export const qualityService = new QualityService();
