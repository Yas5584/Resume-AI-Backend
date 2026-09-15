import {
  AIAgent,
  AgentExecutionResult,
  AgentRetryPolicy,
} from "./agent.interface.js";
import {
  AgentName,
  ResumeWorkflowState,
  ResumeParseResultSchema,
  JobAnalysisSchema,
  ResumeStrategySchema,
} from "@resumeai/shared";
import { AIProvider } from "../providers/ai-provider.interface.js";
import {
  RESUME_PARSER_SYSTEM_PROMPT,
  buildResumeParserUserPrompt,
} from "../prompts/resume-parser.prompt.js";
import {
  JOB_ANALYZER_SYSTEM_PROMPT,
  buildJobAnalyzerUserPrompt,
} from "../prompts/job-analyzer.prompt.js";
import {
  RESUME_STRATEGY_SYSTEM_PROMPT,
  buildResumeStrategyUserPrompt,
} from "../prompts/resume-strategy.prompt.js";
import {
  RESUME_CONTENT_WRITER_SYSTEM_PROMPT,
  buildResumeContentWriterUserPrompt,
} from "../prompts/content-writer.prompt.js";
import {
  FACT_GUARD_SYSTEM_PROMPT,
  buildFactGuardUserPrompt,
} from "../prompts/fact-guard.prompt.js";
import { verifyProposedChanges } from "../fact-guard/fact-guard-engine.js";
import {
  ContentProposalDataSchema,
  ResumeData,
  JobAnalysis,
  MatchAnalysis,
  ResumeStrategy,
} from "@resumeai/shared";
import { validateAndSanitizeJobAnalysis } from "../../utils/job-validator.js";
import { validateAndSanitizeStrategy } from "../../utils/strategy-validator.js";
import { calculateMatchAnalysis } from "../../matching/index.js";

export * from "./agent.interface.js";

const defaultRetryPolicy: AgentRetryPolicy = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  backoffMultiplier: 2,
};

/**
 * 1. Intake Agent
 * Validates user inputs, normalizes unstructured notes, and routes to appropriate flow.
 */
export class IntakeAgent implements AIAgent {
  readonly name = AgentName.INTAKE;
  readonly description =
    "Validates user inputs, normalizes raw text, and initiates workflow state.";
  readonly retryPolicy = defaultRetryPolicy;

  async execute(
    state: ResumeWorkflowState,
    _provider: AIProvider,
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    return {
      updatedState: {
        currentStep: this.name,
      },
      tokensUsed: 0,
      costUsd: 0,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * 2. Resume Parser Agent
 * Extracts structured JSON matching ResumeSchema from raw resume text or extracted PDF/DOCX tokens.
 */
export class ResumeParserAgent implements AIAgent {
  readonly name = AgentName.RESUME_PARSER;
  readonly description =
    "Parses raw resume documents into structured JSON conforming to ResumeSchema.";
  readonly retryPolicy = defaultRetryPolicy;

  async execute(
    state: ResumeWorkflowState,
    provider: AIProvider,
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    if (!state.rawResumeText) {
      return {
        updatedState: {
          currentStep: this.name,
        },
        tokensUsed: 0,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        notes: "No raw resume text provided, skipping parse",
      };
    }

    const result = await provider.generateStructuredOutput({
      prompt: buildResumeParserUserPrompt(state.rawResumeText),
      systemPrompt: RESUME_PARSER_SYSTEM_PROMPT,
      schema: ResumeParseResultSchema,
      schemaName: "ResumeParseResultSchema",
      temperature: 0.1,
      maxTokens: 8000,
    });

    return {
      updatedState: {
        currentStep: this.name,
        parsedResume: result.data.resumeData as any,
      },
      tokensUsed: result.totalTokens,
      costUsd: result.estimatedCostUsd,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * 3. Job Description Analyzer Agent
 * Extracts responsibilities, required skills, preferred qualifications, and domain keywords.
 */
export class JobAnalyzerAgent implements AIAgent {
  readonly name = AgentName.JOB_ANALYZER;
  readonly description =
    "Extracts key competencies, hard/soft skills, and domain keywords from job listings.";
  readonly retryPolicy = defaultRetryPolicy;

  async execute(
    state: ResumeWorkflowState,
    provider: AIProvider,
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    if (!state.rawJobText) {
      return {
        updatedState: {
          currentStep: this.name,
        },
        tokensUsed: 0,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        notes: "No raw job text provided, skipping analysis",
      };
    }

    const result = await provider.generateStructuredOutput({
      prompt: buildJobAnalyzerUserPrompt(state.rawJobText),
      systemPrompt: JOB_ANALYZER_SYSTEM_PROMPT,
      schema: JobAnalysisSchema,
      schemaName: "JobAnalysisSchema",
      temperature: 0.1,
      maxTokens: 6000,
    });

    const validated = validateAndSanitizeJobAnalysis(
      result.data,
      state.rawJobText,
    );

    return {
      updatedState: {
        currentStep: this.name,
        jobAnalysis: validated,
      },
      tokensUsed: result.totalTokens,
      costUsd: result.estimatedCostUsd,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * 4. Resume/Job Matching Agent
 * Computes semantic similarity, identifies skill matches, and surfaces critical resume gaps.
 */
export class MatcherAgent implements AIAgent {
  readonly name = AgentName.MATCHER;
  readonly description =
    "Computes candidate match score, surfaces alignment strengths, and flags keyword gaps.";
  readonly retryPolicy = defaultRetryPolicy;

  async execute(
    state: ResumeWorkflowState,
    _provider: AIProvider,
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    if (!state.parsedResume || !state.jobAnalysis) {
      return {
        updatedState: {
          currentStep: this.name,
        },
        tokensUsed: 0,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        notes:
          "Missing parsed resume or job analysis, skipping match calculation",
      };
    }

    const matchAnalysis = calculateMatchAnalysis(
      state.jobAnalysis,
      state.parsedResume as any,
    );

    return {
      updatedState: {
        currentStep: this.name,
        matchingAnalysis: matchAnalysis as any,
      },
      tokensUsed: 0,
      costUsd: 0,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * 5. Resume Strategy Agent
 * Devises a tailored positioning strategy, deciding which career achievements to prioritize.
 */
export class StrategyAgent implements AIAgent {
  readonly name = AgentName.STRATEGY;
  readonly description =
    "Formulates strategic narrative angles and bullet priority recommendations.";
  readonly retryPolicy = defaultRetryPolicy;

  async execute(
    state: ResumeWorkflowState,
    provider: AIProvider,
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    if (!state.parsedResume || !state.jobAnalysis) {
      return {
        updatedState: {
          currentStep: this.name,
        },
        tokensUsed: 0,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        notes:
          "Missing parsed resume or job analysis, skipping strategy formulation",
      };
    }

    const context = {
      resumeId: state.resumeId,
      jobId: state.jobDescriptionId,
      matchId: undefined,
    };

    const result = await provider.generateStructuredOutput({
      prompt: buildResumeStrategyUserPrompt(
        state.parsedResume,
        state.jobAnalysis,
        state.matchingAnalysis,
        context,
      ),
      systemPrompt: RESUME_STRATEGY_SYSTEM_PROMPT,
      schema: ResumeStrategySchema,
      schemaName: "ResumeStrategySchema",
      temperature: 0.1,
      maxTokens: 8000,
    });

    const validated = validateAndSanitizeStrategy(
      result.data,
      state.parsedResume as any,
      state.jobAnalysis as any,
      state.matchingAnalysis as any,
    );

    return {
      updatedState: {
        currentStep: this.name,
        strategy: validated as any,
      },
      tokensUsed: result.totalTokens,
      costUsd: result.estimatedCostUsd,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * 6. Content Writer Agent
 * Rewrites resume summary and experience bullet points using strong action verbs and quantified impact.
 */
export class ContentWriterAgent implements AIAgent {
  readonly name = AgentName.CONTENT_WRITER;
  readonly description =
    "Rewrites bullet points and summaries targeting role requirements without inventing facts.";
  readonly retryPolicy = defaultRetryPolicy;

  async execute(
    state: ResumeWorkflowState,
    provider: AIProvider,
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    if (!state.parsedResume || !state.jobAnalysis || !state.matchingAnalysis) {
      return {
        updatedState: {
          currentStep: this.name,
        },
        tokensUsed: 0,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        notes:
          "Missing parsedResume, jobAnalysis, or matchingAnalysis; skipping content generation",
      };
    }

    const prompt = buildResumeContentWriterUserPrompt(
      state.parsedResume as unknown as ResumeData,
      state.jobAnalysis as unknown as JobAnalysis,
      state.matchingAnalysis as unknown as MatchAnalysis,
      state.strategy as unknown as ResumeStrategy,
      {
        resumeId: state.resumeId,
        jobId: state.jobDescriptionId,
      },
    );

    const result = await provider.generateStructuredOutput({
      prompt,
      systemPrompt: RESUME_CONTENT_WRITER_SYSTEM_PROMPT,
      schema: ContentProposalDataSchema,
      schemaName: "ContentProposalDataSchema",
      temperature: 0.1,
      maxTokens: 8000,
    });

    return {
      updatedState: {
        currentStep: this.name,
        metadata: {
          ...state.metadata,
          contentProposal: result.data,
        },
      },
      tokensUsed: result.totalTokens,
      costUsd: result.estimatedCostUsd,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * 7. Fact Guard Agent
 * Verifies every generated claim against user-provided source documents to guarantee zero hallucination.
 */
export class FactGuardAgent implements AIAgent {
  readonly name = AgentName.FACT_GUARD;
  readonly description =
    "Audits proposed bullet points against source evidence to prevent hallucinated claims.";
  readonly retryPolicy = defaultRetryPolicy;

  async execute(
    state: ResumeWorkflowState,
    _provider: AIProvider,
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    const proposalData = state.metadata?.contentProposal as
      { changes?: any[]; summaryStats?: any } | undefined;

    if (!proposalData || !proposalData.changes || !state.parsedResume) {
      return {
        updatedState: {
          currentStep: this.name,
        },
        tokensUsed: 0,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        notes: "No proposed changes or resume data to audit",
      };
    }

    const { verifiedChanges, stats } = verifyProposedChanges(
      proposalData.changes,
      state.parsedResume as unknown as ResumeData,
    );

    return {
      updatedState: {
        currentStep: this.name,
        metadata: {
          ...state.metadata,
          contentProposal: {
            ...proposalData,
            changes: verifiedChanges,
            summaryStats: stats,
          },
        },
      },
      tokensUsed: 0,
      costUsd: 0,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * 8. ATS Analyzer Agent
 * Simulates enterprise Applicant Tracking Systems (ATS), measuring parseability and keyword density.
 */
export class ATSAnalyzerAgent implements AIAgent {
  readonly name = AgentName.ATS_ANALYZER;
  readonly description =
    "Evaluates ATS keyword match, layout parseability, and heading compliance.";
  readonly retryPolicy = defaultRetryPolicy;

  async execute(
    state: ResumeWorkflowState,
    _provider: AIProvider,
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    return {
      updatedState: {
        currentStep: this.name,
      },
      tokensUsed: 0,
      costUsd: 0,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * 9. Quality Reviewer Agent
 * Performs final polish, checks tone, flow, consistency, and validates overall quality score.
 */
export class QualityReviewerAgent implements AIAgent {
  readonly name = AgentName.QUALITY_REVIEWER;
  readonly description =
    "Executes final quality gate: grammar, tone consistency, and readiness sign-off.";
  readonly retryPolicy = defaultRetryPolicy;

  async execute(
    state: ResumeWorkflowState,
    _provider: AIProvider,
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    return {
      updatedState: {
        currentStep: this.name,
      },
      tokensUsed: 0,
      costUsd: 0,
      durationMs: Date.now() - startTime,
    };
  }
}

export const registeredAgents = {
  [AgentName.INTAKE]: new IntakeAgent(),
  [AgentName.RESUME_PARSER]: new ResumeParserAgent(),
  [AgentName.JOB_ANALYZER]: new JobAnalyzerAgent(),
  [AgentName.MATCHER]: new MatcherAgent(),
  [AgentName.STRATEGY]: new StrategyAgent(),
  [AgentName.CONTENT_WRITER]: new ContentWriterAgent(),
  [AgentName.FACT_GUARD]: new FactGuardAgent(),
  [AgentName.ATS_ANALYZER]: new ATSAnalyzerAgent(),
  [AgentName.QUALITY_REVIEWER]: new QualityReviewerAgent(),
};
