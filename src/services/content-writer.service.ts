import { prisma, ContentProposalStatus, Prisma } from "@resumeai/database";
import {
  ResumeData,
  ResumeDataSchema,
  JobAnalysis,
  JobAnalysisSchema,
  MatchAnalysis,
  ResumeStrategy,
  ResumeStrategySchema,
  ContentProposalData,
  ContentProposalDataSchema,
  ResumeContentChange,
  RegenerateSectionInput,
  SectionRegenerationResponse,
  SectionRegenerationOutputSchema,
} from "@resumeai/shared";
import { contentProposalRepository } from "../repositories/content-proposal.repository.js";
import { resumeRepository } from "../repositories/resume.repository.js";
import { jobRepository } from "../repositories/job.repository.js";
import { matchRepository } from "../repositories/match.repository.js";
import { strategyRepository } from "../repositories/strategy.repository.js";
import { calculateMatchAnalysis } from "../matching/index.js";
import { getAIProvider } from "../ai/providers/index.js";
import {
  RESUME_CONTENT_WRITER_SYSTEM_PROMPT,
  buildResumeContentWriterUserPrompt,
} from "../ai/prompts/content-writer.prompt.js";
import {
  SECTION_REGENERATION_SYSTEM_PROMPT,
  buildSectionRegenerationUserPrompt,
} from "../ai/prompts/section-regeneration.prompt.js";
import {
  verifyProposedChanges,
  verifySingleChange,
} from "../ai/fact-guard/fact-guard-engine.js";
import { buildEvidenceMap } from "../ai/evidence/evidence-map.js";
import { validateATS } from "../ai/ats-validator/ats-validator.js";
import { AppError } from "../errors/index.js";
import { logger } from "../utils/logger.js";

export class ContentWriterService {
  private proposalRepo = contentProposalRepository;
  private resumeRepo = resumeRepository;
  private jobRepo = jobRepository;
  private matchRepo = matchRepository;
  private strategyRepo = strategyRepository;

  /**
   * Generates a new content improvement proposal or reuses an existing fresh proposal.
   */
  async generateProposal(
    userId: string,
    resumeId: string,
    jobId: string,
    matchId?: string,
    strategyId?: string,
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

    // Validate Job Analysis
    if (job.status !== "COMPLETED" || !job.parsedData) {
      throw AppError.badRequest(
        "Job description must be analyzed before generating content improvements. Please analyze the job description first.",
      );
    }

    const parsedJobAnalysis = JobAnalysisSchema.safeParse(job.parsedData);
    if (!parsedJobAnalysis.success) {
      throw AppError.badRequest("Invalid job analysis structured data");
    }

    const parsedResumeData = ResumeDataSchema.safeParse(resume.resumeData);
    if (!parsedResumeData.success) {
      throw AppError.badRequest("Invalid resume structured data");
    }

    // 2. Resolve Match Analysis
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

    // 3. Resolve Strategy
    let strategyRecord = null;
    let strategyData: ResumeStrategy | null = null;

    if (strategyId) {
      strategyRecord = await this.strategyRepo.findByIdAndUserId(
        strategyId,
        userId,
      );
      if (strategyRecord) {
        strategyData = strategyRecord.strategyData as unknown as ResumeStrategy;
      }
    } else {
      strategyRecord = await this.strategyRepo.findByResumeAndJob(
        userId,
        resumeId,
        jobId,
      );
      if (strategyRecord) {
        strategyData = strategyRecord.strategyData as unknown as ResumeStrategy;
      }
    }

    // 4. Duplicate Generation Prevention (Reuse fresh un-applied proposal if safe)
    const existingProposal = await this.proposalRepo.findByResumeAndJob(
      userId,
      resumeId,
      jobId,
    );

    if (
      existingProposal &&
      existingProposal.status !== ContentProposalStatus.APPLIED &&
      existingProposal.status !== ContentProposalStatus.REJECTED
    ) {
      const isResumeFresh =
        !existingProposal.resumeUpdatedAt ||
        new Date(resume.updatedAt) <=
          new Date(existingProposal.resumeUpdatedAt);
      const isJobFresh =
        !existingProposal.jobUpdatedAt ||
        new Date(job.updatedAt) <= new Date(existingProposal.jobUpdatedAt);

      if (isResumeFresh && isJobFresh) {
        logger.info("Reusing existing fresh content proposal", {
          proposalId: existingProposal.id,
          userId,
          resumeId,
          jobId,
        });

        return {
          id: existingProposal.id,
          proposalId: existingProposal.id,
          status: existingProposal.status,
          isStale: false,
          changes: (existingProposal.proposalData as any)?.changes || [],
          summaryStats:
            (existingProposal.proposalData as any)?.summaryStats || {},
          generalNotes: (existingProposal.proposalData as any)?.generalNotes,
          resumeUpdatedAt: existingProposal.resumeUpdatedAt,
          jobUpdatedAt: existingProposal.jobUpdatedAt,
          createdAt: existingProposal.createdAt,
          updatedAt: existingProposal.updatedAt,
        };
      }
    }

    // 5. Generate AI Proposal
    const provider = getAIProvider();
    const prompt = buildResumeContentWriterUserPrompt(
      parsedResumeData.data,
      parsedJobAnalysis.data,
      matchAnalysis,
      strategyData,
      {
        resumeId,
        jobId,
        matchId: matchRecord?.id,
        strategyId: strategyRecord?.id,
      },
    );

    const aiResult = await provider.generateStructuredOutput({
      prompt,
      systemPrompt: RESUME_CONTENT_WRITER_SYSTEM_PROMPT,
      schema: ContentProposalDataSchema,
      schemaName: "ContentProposalDataSchema",
      temperature: 0.1,
      maxTokens: 8000,
    });

    const rawProposalData = aiResult.data as ContentProposalData;

    // 6. Fact Guard Engine Verification
    const { verifiedChanges, stats } = verifyProposedChanges(
      rawProposalData.changes,
      parsedResumeData.data,
    );

    const validatedProposalData: ContentProposalData = {
      ...rawProposalData,
      changes: verifiedChanges,
      summaryStats: stats,
      targetJobTitle: job.title || "Target Position",
      targetCompany: job.company || undefined,
    };

    // 7. Persist Proposal in Database
    const savedProposal = await this.proposalRepo.create({
      userId,
      resumeId,
      jobId,
      matchId: matchRecord?.id,
      strategyId: strategyRecord?.id,
      status: ContentProposalStatus.DRAFT,
      resumeUpdatedAt: resume.updatedAt,
      jobUpdatedAt: job.updatedAt,
      matchUpdatedAt: matchRecord?.updatedAt,
      strategyUpdatedAt: strategyRecord?.updatedAt,
      proposalData: validatedProposalData as unknown as Prisma.InputJsonValue,
    });

    const durationMs = Date.now() - startTime;
    logger.info("Content proposal generated successfully", {
      proposalId: savedProposal.id,
      userId,
      resumeId,
      jobId,
      totalProposed: stats.totalProposed,
      verifiedCount: stats.verifiedCount,
      blockedCount: stats.blockedCount,
      durationMs,
    });

    return {
      id: savedProposal.id,
      proposalId: savedProposal.id,
      status: savedProposal.status,
      isStale: false,
      changes: validatedProposalData.changes,
      summaryStats: validatedProposalData.summaryStats,
      generalNotes: validatedProposalData.generalNotes,
      resumeUpdatedAt: savedProposal.resumeUpdatedAt,
      jobUpdatedAt: savedProposal.jobUpdatedAt,
      createdAt: savedProposal.createdAt,
      updatedAt: savedProposal.updatedAt,
    };
  }

  /**
   * Retrieves proposal with freshness / stale evaluation
   */
  async getProposal(id: string, userId: string) {
    const record = await this.proposalRepo.findByIdAndUserId(id, userId);
    if (!record) {
      throw AppError.notFound("Content proposal");
    }

    const resumeUpdated = record.resume?.updatedAt;
    const jobUpdated = record.job?.updatedAt;
    const matchUpdated = record.match?.updatedAt;
    const strategyUpdated = record.strategy?.updatedAt;

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
    if (
      record.strategyUpdatedAt &&
      strategyUpdated &&
      new Date(strategyUpdated) > new Date(record.strategyUpdatedAt)
    ) {
      isStale = true;
    }

    const proposalData = record.proposalData as Record<string, any>;

    return {
      id: record.id,
      proposalId: record.id,
      userId: record.userId,
      resumeId: record.resumeId,
      jobId: record.jobId,
      matchId: record.matchId,
      strategyId: record.strategyId,
      appliedVersionId: record.appliedVersionId,
      status:
        isStale && record.status === ContentProposalStatus.DRAFT
          ? ContentProposalStatus.STALE
          : record.status,
      isStale,
      resumeTitle: record.resume?.title,
      jobTitle: record.job?.title,
      jobCompany: record.job?.company,
      changes: proposalData.changes || [],
      summaryStats: proposalData.summaryStats || {},
      generalNotes: proposalData.generalNotes,
      resumeUpdatedAt: record.resumeUpdatedAt,
      jobUpdatedAt: record.jobUpdatedAt,
      matchUpdatedAt: record.matchUpdatedAt,
      strategyUpdatedAt: record.strategyUpdatedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      appliedVersion: record.appliedVersion,
    };
  }

  /**
   * Updates status of an individual proposed change (accept / reject)
   */
  async updateChangeStatus(
    proposalId: string,
    userId: string,
    changeId: string,
    newStatus: "APPROVED" | "REJECTED",
  ) {
    const record = await this.proposalRepo.findByIdAndUserId(
      proposalId,
      userId,
    );
    if (!record) {
      throw AppError.notFound("Content proposal");
    }

    if (record.status === ContentProposalStatus.APPLIED) {
      throw AppError.badRequest(
        "Cannot modify change status on an already applied proposal.",
      );
    }

    const proposalData = record.proposalData as unknown as ContentProposalData;
    const change = proposalData.changes.find((c) => c.id === changeId);

    if (!change) {
      throw AppError.notFound(`Change with ID '${changeId}'`);
    }

    // Fact Guard Enforcement: Never allow approving a BLOCKED change
    if (change.status === "BLOCKED" && newStatus === "APPROVED") {
      throw AppError.badRequest(
        "Cannot approve a change that has been blocked by Fact Guard.",
      );
    }

    change.status = newStatus;

    // Recalculate summary stats
    const verifiedCount = proposalData.changes.filter(
      (c) => c.status === "APPROVED" || c.status === "PENDING",
    ).length;
    const blockedCount = proposalData.changes.filter(
      (c) => c.status === "BLOCKED",
    ).length;
    const uncertainCount = proposalData.changes.filter(
      (c) => c.status === "REJECTED",
    ).length;

    proposalData.summaryStats = {
      totalProposed: proposalData.changes.length,
      verifiedCount,
      blockedCount,
      uncertainCount,
    };

    const hasApproved = proposalData.changes.some(
      (c) => c.status === "APPROVED",
    );
    const hasPending = proposalData.changes.some((c) => c.status === "PENDING");
    let overallStatus: ContentProposalStatus = ContentProposalStatus.DRAFT;
    if (hasApproved && hasPending) {
      overallStatus = ContentProposalStatus.PARTIALLY_ACCEPTED;
    } else if (hasApproved && !hasPending) {
      overallStatus = ContentProposalStatus.ACCEPTED;
    }

    await this.proposalRepo.update(proposalId, userId, {
      status: overallStatus,
      proposalData: proposalData as unknown as Prisma.InputJsonValue,
    });

    return {
      success: true,
      changeId,
      status: newStatus,
      proposalStats: proposalData.summaryStats,
    };
  }

  /**
   * Revalidates proposal against updated resume data
   */
  async revalidateProposal(proposalId: string, userId: string) {
    const record = await this.proposalRepo.findByIdAndUserId(
      proposalId,
      userId,
    );
    if (!record) {
      throw AppError.notFound("Content proposal");
    }

    const resume = await this.resumeRepo.findByIdAndUserId(
      record.resumeId,
      userId,
    );
    if (!resume) {
      throw AppError.notFound("Resume");
    }

    const parsedResumeData = ResumeDataSchema.parse(resume.resumeData);
    const proposalData = record.proposalData as unknown as ContentProposalData;

    const { verifiedChanges, stats } = verifyProposedChanges(
      proposalData.changes,
      parsedResumeData,
    );

    proposalData.changes = verifiedChanges;
    proposalData.summaryStats = stats;

    const updated = await this.proposalRepo.update(proposalId, userId, {
      resumeUpdatedAt: resume.updatedAt,
      proposalData: proposalData as unknown as Prisma.InputJsonValue,
      status: ContentProposalStatus.DRAFT,
    });

    return {
      id: updated?.id,
      isStale: false,
      changes: proposalData.changes,
      summaryStats: proposalData.summaryStats,
    };
  }

  /**
   * Atomically applies approved, verified changes to the resume.
   * Creates a ResumeVersion snapshot first!
   */
  async applyProposal(
    proposalId: string,
    userId: string,
    selectedChangeIds?: string[],
  ) {
    // 1. Dual Ownership & Freshness Verification
    const proposal = await this.proposalRepo.findByIdAndUserId(
      proposalId,
      userId,
    );
    if (!proposal) {
      throw AppError.notFound("Content proposal");
    }

    if (proposal.status === ContentProposalStatus.APPLIED) {
      throw AppError.badRequest("This proposal has already been applied.");
    }

    const resume = await this.resumeRepo.findByIdAndUserId(
      proposal.resumeId,
      userId,
    );
    if (!resume) {
      throw AppError.notFound("Resume");
    }

    // Stale Detection on Apply
    if (
      proposal.resumeUpdatedAt &&
      new Date(resume.updatedAt) > new Date(proposal.resumeUpdatedAt)
    ) {
      throw AppError.conflict(
        "STALE_PROPOSAL: This proposal was generated from an older version of your resume. Please regenerate suggestions.",
      );
    }

    const proposalData =
      proposal.proposalData as unknown as ContentProposalData;

    // Filter changes to apply
    let changesToApply: ResumeContentChange[];

    if (selectedChangeIds && selectedChangeIds.length > 0) {
      changesToApply = proposalData.changes.filter((c) =>
        selectedChangeIds.includes(c.id),
      );
    } else {
      // Apply all approved or verified pending changes
      changesToApply = proposalData.changes.filter(
        (c) => c.status === "APPROVED" || c.status === "PENDING",
      );
    }

    // STRICT CHECK: Ensure NO BLOCKED change can ever be applied!
    for (const change of changesToApply) {
      if (change.status === "BLOCKED") {
        throw AppError.badRequest(
          `Cannot apply change '${change.id}': This change was blocked by Fact Guard (${change.blockedReason || "unsupported claim"}).`,
        );
      }
    }

    if (changesToApply.length === 0) {
      throw AppError.badRequest("No approved changes selected to apply.");
    }

    // 2. Perform Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Reload authoritative Resume row inside transaction
      const currentResume = await tx.resume.findUnique({
        where: { id: proposal.resumeId },
      });
      if (!currentResume) throw AppError.notFound("Resume");

      // Verify not stale inside transaction
      if (
        proposal.resumeUpdatedAt &&
        new Date(currentResume.updatedAt) > new Date(proposal.resumeUpdatedAt)
      ) {
        throw AppError.conflict(
          "STALE_PROPOSAL: Resume was modified concurrently. Aborting apply.",
        );
      }

      // Determine next version number
      const latestVersion = await tx.resumeVersion.findFirst({
        where: { resumeId: proposal.resumeId },
        orderBy: { versionNumber: "desc" },
      });
      const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;

      // Create pre-apply ResumeVersion snapshot
      const snapshotVersion = await tx.resumeVersion.create({
        data: {
          resumeId: proposal.resumeId,
          versionNumber: nextVersionNumber,
          title: currentResume.title,
          resumeData: currentResume.resumeData as Prisma.InputJsonValue,
          templateConfig: currentResume.templateConfig as Prisma.InputJsonValue,
          changeSummary: `Before applying AI Content Writer changes (Proposal ${proposal.id})`,
        },
      });

      // Apply changes to clone of resumeData
      const clonedResumeData: ResumeData = JSON.parse(
        JSON.stringify(currentResume.resumeData),
      );

      for (const change of changesToApply) {
        // Quality Gate re-validation on Apply (authoritative closed-world re-verification)
        const recheck = verifySingleChange(
          change,
          currentResume.resumeData as unknown as ResumeData,
        );
        if (
          recheck.verifiedChange.status === "BLOCKED" ||
          recheck.unsupportedClaimsCount > 0
        ) {
          throw AppError.badRequest(
            `Apply rejected by Fact Guard: Change '${change.id}' failed authoritative verification (${recheck.verifiedChange.blockedReason || "unsupported factual claim"}).`,
          );
        }
        this.applySingleChange(clonedResumeData, change);
      }

      // Validate updated resumeData against schema
      const parseResult = ResumeDataSchema.safeParse(clonedResumeData);
      if (!parseResult.success) {
        throw AppError.badRequest(
          `Resulting resume data failed schema validation: ${parseResult.error.message}`,
        );
      }

      // Persist updated ResumeData
      const updatedResume = await tx.resume.update({
        where: { id: proposal.resumeId },
        data: {
          resumeData: parseResult.data as unknown as Prisma.InputJsonValue,
        },
      });

      // Mark proposal as APPLIED
      const updatedProposal = await tx.contentProposal.update({
        where: { id: proposal.id },
        data: {
          status: ContentProposalStatus.APPLIED,
          appliedVersionId: snapshotVersion.id,
        },
      });

      return {
        resume: updatedResume,
        version: snapshotVersion,
        appliedChangesCount: changesToApply.length,
        proposal: updatedProposal,
      };
    });

    logger.info("Applied content proposal changes successfully", {
      proposalId,
      userId,
      resumeId: proposal.resumeId,
      versionNumber: result.version.versionNumber,
      appliedCount: result.appliedChangesCount,
    });

    return {
      success: true,
      resumeId: result.resume.id,
      versionId: result.version.id,
      versionNumber: result.version.versionNumber,
      appliedChangesCount: result.appliedChangesCount,
      resumeData: result.resume.resumeData,
    };
  }

  /**
   * Helper to cleanly apply an individual change to a cloned ResumeData object
   */
  private applySingleChange(
    resumeData: ResumeData,
    change: ResumeContentChange,
  ) {
    if (change.section === "summary") {
      resumeData.summary = change.proposedValue;
      return;
    }

    if (change.section === "experience") {
      const expList = resumeData.experience || [];
      const targetExp = change.itemId
        ? expList.find((e) => e.id === change.itemId)
        : expList[0];

      if (!targetExp) return;

      if (change.field === "jobTitle" || change.field === "position") {
        targetExp.jobTitle = change.proposedValue;
        targetExp.position = change.proposedValue;
      } else if (
        change.field.startsWith("bullets[") ||
        change.field.startsWith("bullets.") ||
        change.field === "bullet"
      ) {
        // Find index or match by originalValue
        const bulletMatch = /bullets(?:\[(\d+)\]|\.(\d+))/.exec(change.field);
        const index = bulletMatch
          ? parseInt(bulletMatch[1] || bulletMatch[2], 10)
          : targetExp.bullets.findIndex(
              (b) =>
                b.trim().toLowerCase() ===
                change.originalValue.trim().toLowerCase(),
            );

        if (index >= 0 && index < targetExp.bullets.length) {
          targetExp.bullets[index] = change.proposedValue;
        } else if (change.originalValue) {
          const matchIdx = targetExp.bullets.findIndex((b) =>
            b.includes(change.originalValue.slice(0, 20)),
          );
          if (matchIdx >= 0) {
            targetExp.bullets[matchIdx] = change.proposedValue;
          }
        }
      }
      return;
    }

    if (change.section === "projects") {
      const projList = resumeData.projects || [];
      const targetProj = change.itemId
        ? projList.find((p) => p.id === change.itemId)
        : projList[0];

      if (!targetProj) return;

      if (change.field === "description") {
        targetProj.description = change.proposedValue;
      } else if (
        change.field.startsWith("bullets[") ||
        change.field.startsWith("bullets.") ||
        change.field === "bullet"
      ) {
        const bulletMatch = /bullets(?:\[(\d+)\]|\.(\d+))/.exec(change.field);
        const index = bulletMatch
          ? parseInt(bulletMatch[1] || bulletMatch[2], 10)
          : targetProj.bullets.findIndex(
              (b) =>
                b.trim().toLowerCase() ===
                change.originalValue.trim().toLowerCase(),
            );

        if (index >= 0 && index < targetProj.bullets.length) {
          targetProj.bullets[index] = change.proposedValue;
        }
      }
      return;
    }

    if (change.section === "skills") {
      // Safe keyword alignment in skills
      const skillGroups = resumeData.skills || [];
      const targetGroup = change.itemId
        ? skillGroups.find((g) => g.id === change.itemId)
        : skillGroups[0];

      if (targetGroup) {
        const newSkills = change.proposedValue
          .split(/[,/]/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (newSkills.length > 0) {
          targetGroup.skills = Array.from(
            new Set([...targetGroup.skills, ...newSkills]),
          );
        }
      }
      return;
    }

    if (change.section === "achievements") {
      const achList = resumeData.achievements || [];
      const targetAch = change.itemId
        ? achList.find((a) => a.id === change.itemId)
        : achList[0];
      if (targetAch) {
        targetAch.description = change.proposedValue;
      }
      return;
    }

    if (change.section === "education") {
      const eduList = resumeData.education || [];
      const targetEdu = change.itemId
        ? eduList.find((e) => e.id === change.itemId)
        : eduList[0];
      if (targetEdu && change.field === "description") {
        targetEdu.description = change.proposedValue;
      }
      return;
    }
  }

  /**
   * Regenerates or improves an individual resume section with Fact Guard & ATS checks.
   */
  async regenerateSection(
    userId: string,
    input: RegenerateSectionInput,
  ): Promise<SectionRegenerationResponse> {
    const startTime = Date.now();

    // 1. Authoritative Resume Ownership Check
    const resume = await this.resumeRepo.findByIdAndUserId(
      input.resumeId,
      userId,
    );
    if (!resume) {
      throw AppError.notFound("Resume");
    }

    const parsedResumeData = ResumeDataSchema.safeParse(resume.resumeData);
    if (!parsedResumeData.success) {
      throw AppError.badRequest("Invalid resume structured data in database");
    }
    const resumeData = parsedResumeData.data;

    // 2. Extract Authoritative Original Value Server-side
    let originalValue = "";
    if (input.section === "summary") {
      originalValue = resumeData.summary || "";
    } else if (input.section === "experience") {
      const expList = resumeData.experience || [];
      const targetExp = input.itemId
        ? expList.find((e) => e.id === input.itemId)
        : expList[0];
      if (targetExp) {
        const bulletMatch = /bullets(?:\[(\d+)\]|\.(\d+))/.exec(input.field);
        if (
          bulletMatch ||
          input.field.startsWith("bullets[") ||
          input.field.startsWith("bullets.") ||
          input.field === "bullet"
        ) {
          const idx = bulletMatch
            ? parseInt(bulletMatch[1] || bulletMatch[2], 10)
            : 0;
          originalValue =
            targetExp.bullets?.[idx] || targetExp.bullets?.[0] || "";
        } else {
          originalValue = (targetExp as any)[input.field] || "";
        }
      }
    } else if (input.section === "projects") {
      const projList = resumeData.projects || [];
      const targetProj = input.itemId
        ? projList.find((p) => p.id === input.itemId)
        : projList[0];
      if (targetProj) {
        const bulletMatch = /bullets(?:\[(\d+)\]|\.(\d+))/.exec(input.field);
        if (
          bulletMatch ||
          input.field.startsWith("bullets[") ||
          input.field.startsWith("bullets.") ||
          input.field === "bullet"
        ) {
          const idx = bulletMatch
            ? parseInt(bulletMatch[1] || bulletMatch[2], 10)
            : 0;
          originalValue =
            targetProj.bullets?.[idx] || targetProj.bullets?.[0] || "";
        } else {
          originalValue =
            targetProj.description || (targetProj as any)[input.field] || "";
        }
      }
    } else if (input.section === "skills") {
      const skillGroups = resumeData.skills || [];
      const targetGroup = input.itemId
        ? skillGroups.find((s) => s.id === input.itemId)
        : skillGroups[0];
      if (targetGroup) {
        originalValue = targetGroup.skills.join(", ");
      }
    } else if (input.section === "achievements") {
      const achList = resumeData.achievements || [];
      const targetAch = input.itemId
        ? achList.find((a) => a.id === input.itemId)
        : achList[0];
      if (targetAch) {
        originalValue = targetAch.description || "";
      }
    } else if (input.section === "education") {
      const eduList = resumeData.education || [];
      const targetEdu = input.itemId
        ? eduList.find((e) => e.id === input.itemId)
        : eduList[0];
      if (targetEdu) {
        originalValue = targetEdu.description || "";
      }
    } else if (input.section === "certifications") {
      const certList = resumeData.certifications || [];
      const targetCert = input.itemId
        ? certList.find((c) => c.id === input.itemId)
        : certList[0];
      if (targetCert) {
        originalValue = targetCert.issuer || "";
      }
    }

    // 3. Resolve Target Job Context (Mode 1 vs Mode 2)
    let targetJobAnalysis: JobAnalysis | null = null;
    let strategy: ResumeStrategy | null = null;

    if (input.targetJobId) {
      const job = await this.jobRepo.findByIdAndUserId(
        input.targetJobId,
        userId,
      );
      if (!job) {
        throw AppError.notFound("Job description");
      }
      if (job.status === "COMPLETED" && job.parsedData) {
        const parsed = JobAnalysisSchema.safeParse(job.parsedData);
        if (parsed.success) {
          targetJobAnalysis = parsed.data;
        }
      }
      const stratRecord = await this.strategyRepo.findByResumeAndJob(
        userId,
        resume.id,
        job.id,
      );
      if (stratRecord?.strategyData) {
        const parsedStrat = ResumeStrategySchema.safeParse(
          stratRecord.strategyData,
        );
        if (parsedStrat.success) {
          strategy = parsedStrat.data;
        }
      }
    }

    // 4. Build Section Prompt with EvidenceMap & Execute AI
    const evidenceMap = buildEvidenceMap(resumeData);
    const prompt = buildSectionRegenerationUserPrompt({
      section: input.section,
      field: input.field,
      itemId: input.itemId,
      originalValue,
      resumeData,
      evidenceMap,
      targetJobAnalysis,
      strategy,
      instruction: input.instruction,
    });

    const provider = getAIProvider();
    let currentPrompt = prompt;
    let verifiedChange: any;
    let claims: any;
    let factGuardScore: any;
    let supportedClaimsCount: any;
    let unsupportedClaimsCount: any;
    let aiResult: any;

    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      aiResult = await provider.generateStructuredOutput({
        prompt: currentPrompt,
        systemPrompt: SECTION_REGENERATION_SYSTEM_PROMPT,
        schema: SectionRegenerationOutputSchema,
        schemaName: "SectionRegenerationOutputSchema",
        temperature: attempt === 0 ? 0.2 : 0.05,
        maxTokens: 2000,
      });

      // 5. Fact Guard Verification
      const changeId = `sec_change_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const candidateChange: ResumeContentChange = {
        id: changeId,
        section: input.section,
        itemId: input.itemId,
        field: input.field,
        originalValue,
        proposedValue: aiResult.data.proposedValue,
        changeType: aiResult.data.changeType || "REWRITE",
        targetRequirementIds: [],
        evidenceIds:
          aiResult.data.evidenceIds && aiResult.data.evidenceIds.length > 0
            ? aiResult.data.evidenceIds
            : [input.itemId || `${input.section}_evidence`],
        rationale: aiResult.data.rationale,
        risk: "LOW",
        status: "PENDING",
        factCheckStatus: "UNCERTAIN",
      };

      const verification = verifySingleChange(candidateChange, resumeData);
      verifiedChange = verification.verifiedChange;
      claims = verification.claims;
      factGuardScore = verification.factGuardScore;
      supportedClaimsCount = verification.supportedClaimsCount;
      unsupportedClaimsCount = verification.unsupportedClaimsCount;

      // If approved by Fact Guard (not blocked), break immediately!
      if (verifiedChange.status !== "BLOCKED") {
        break;
      }

      // If blocked and attempts remain, prepare self-healing prompt
      if (attempt < maxAttempts - 1) {
        const unsupportedItems = claims
          .filter((c: any) => c.factCheckStatus !== "SUPPORTED")
          .map(
            (c: any) =>
              `- "${c.claim}": ${c.reason || "Unsupported or unevidenced claim"}`,
          )
          .join("\n");

        logger.warn(
          `[SectionRegeneration] Fact Guard blocked attempt ${attempt + 1}. Triggering self-healing retry...`,
          { unsupportedItems },
        );

        currentPrompt = `${prompt}

=== FACT GUARD ADVERSARIAL FEEDBACK (ATTEMPT ${attempt + 1} REJECTED) ===
Your previous proposed rewrite was:
"${aiResult.data.proposedValue}"

Fact Guard BLOCKED this rewrite due to the following unsupported claims or metric hallucinations:
${unsupportedItems}

MANDATORY SELF-HEALING RULES FOR RETRY:
1. Completely REMOVE every hallucinated metric, transformed unit, or unevidenced claim listed above.
2. DO NOT use unevidenced buzzwords like "scalable", "enterprise", or "high-throughput".
3. If a metric cannot be stated with 100% exact evidence (exact project + exact unit), DO NOT INCLUDE ANY METRIC.
4. Rewrite the text cleanly relying ONLY on verified technologies and factual projects.`;
      }
    }

    // 6. ATS Validation with Claims Context
    const atsChecks = validateATS(verifiedChange.proposedValue, input.section, {
      claims,
      unsupportedClaimsCount,
      originalText: originalValue,
    });

    // 7. Persist Proposal in Database with DRAFT status
    const proposalData: ContentProposalData = {
      changes: [verifiedChange],
      summaryStats: {
        totalProposed: 1,
        verifiedCount: verifiedChange.status === "BLOCKED" ? 0 : 1,
        blockedCount: verifiedChange.status === "BLOCKED" ? 1 : 0,
        uncertainCount: 0,
      },
      generalNotes: `Section regeneration for ${input.section} (${input.field})`,
      targetJobTitle: targetJobAnalysis?.jobTitle || undefined,
      targetCompany: targetJobAnalysis?.company || undefined,
    };

    const proposal = await this.proposalRepo.create({
      userId,
      resumeId: resume.id,
      jobId: input.targetJobId || null,
      status: ContentProposalStatus.DRAFT,
      resumeUpdatedAt: resume.updatedAt,
      jobUpdatedAt: input.targetJobId ? new Date() : null,
      proposalData: proposalData as unknown as Prisma.InputJsonValue,
    });

    logger.info("Section regeneration proposal created successfully", {
      proposalId: proposal.id,
      changeId: verifiedChange.id,
      section: input.section,
      status: verifiedChange.status,
      factGuardScore,
      supportedClaimsCount,
      unsupportedClaimsCount,
      durationMs: Date.now() - startTime,
    });

    return {
      proposalId: proposal.id,
      changeId: verifiedChange.id,
      originalValue,
      proposedValue: verifiedChange.proposedValue,
      rationale: verifiedChange.rationale,
      evidenceIds: verifiedChange.evidenceIds,
      factCheckStatus: verifiedChange.factCheckStatus || "SUPPORTED",
      status: verifiedChange.status,
      blockedReason: verifiedChange.blockedReason,
      atsChecks,
      claims,
      factGuardScore,
      supportedClaimsCount,
      unsupportedClaimsCount,
    };
  }

  /**
   * Rejects entire proposal
   */
  async rejectProposal(proposalId: string, userId: string) {
    const proposal = await this.proposalRepo.findByIdAndUserId(
      proposalId,
      userId,
    );
    if (!proposal) {
      throw AppError.notFound("Content proposal");
    }

    await this.proposalRepo.update(proposalId, userId, {
      status: ContentProposalStatus.REJECTED,
    });

    return { success: true, status: ContentProposalStatus.REJECTED };
  }

  /**
   * Deletes proposal
   */
  async deleteProposal(proposalId: string, userId: string) {
    const deleted = await this.proposalRepo.delete(proposalId, userId);
    if (!deleted) {
      throw AppError.notFound("Content proposal");
    }

    return { success: true };
  }
}

export const contentWriterService = new ContentWriterService();
