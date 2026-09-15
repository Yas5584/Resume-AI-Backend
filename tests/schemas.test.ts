import { describe, it, expect } from "vitest";
import {
  ResumeSchema,
  JobAnalysisSchema,
  ClaimEvidenceSchema,
  VerificationStatus,
  ResumeWorkflowStateSchema,
  WorkflowType,
  WorkflowStatus,
} from "@resumeai/shared";

describe("Shared Domain & AI Schemas Validation", () => {
  it("should validate conforming ResumeSchema data structure", () => {
    const validResume = {
      title: "Full-Stack Architect",
      contact: {
        fullName: "Alex Morgan",
        email: "alex@example.com",
        phone: "+1 555 0192",
      },
      summary:
        "Experienced engineer specializing in cloud-native distributed systems.",
      experience: [
        {
          company: "Acme Corp",
          position: "Senior Engineer",
          startDate: "2022-01",
          current: true,
          bullets: [
            "Architected Fastify API microservices servicing 2M requests/day.",
          ],
          technologiesUsed: ["TypeScript", "Fastify", "PostgreSQL"],
        },
      ],
      education: [
        {
          institution: "State University",
          degree: "B.S. in Computer Science",
        },
      ],
      skills: [
        {
          category: "Backend",
          skills: ["Node.js", "PostgreSQL", "Redis"],
        },
      ],
      projects: [],
      certifications: [],
    };

    const result = ResumeSchema.safeParse(validResume);
    expect(result.success).toBe(true);
  });

  it("should reject invalid resume missing required fields", () => {
    const invalidResume = {
      title: "", // empty title
      contact: {
        fullName: "Incomplete",
        email: "invalid-email-address",
      },
    };

    const result = ResumeSchema.safeParse(invalidResume);
    expect(result.success).toBe(false);
  });

  it("should validate ClaimEvidenceSchema four-state verification", () => {
    const claim = {
      id: "claim-101",
      claimText: "Reduced latency by 35% using caching",
      claimCategory: "METRIC_OR_KPI",
      targetSection: "Experience: Acme Corp",
      status: VerificationStatus.SUPPORTED,
      sources: [
        {
          sourceType: "ORIGINAL_RESUME",
          sourceIdentifier: "resume_v1.pdf",
          rawSnippet: "Cut latency 35% through Redis caching",
          confidenceScore: 0.95,
        },
      ],
    };

    const parsed = ClaimEvidenceSchema.safeParse(claim);
    expect(parsed.success).toBe(true);
  });

  it("should validate complete ResumeWorkflowStateSchema", () => {
    const state = {
      workflowId: "123e4567-e89b-12d3-a456-426614174000",
      userId: "user-001",
      workflowType: WorkflowType.JOB_TAILORING,
      status: WorkflowStatus.RUNNING,
      retryCount: 0,
      maxRetries: 3,
      revisionHistory: [],
      errors: [],
      metadata: {},
      totalTokensUsed: 1200,
      estimatedCostUsd: 0.005,
    };

    const parsed = ResumeWorkflowStateSchema.safeParse(state);
    expect(parsed.success).toBe(true);
  });

  it("should validate JobAnalysisSchema", () => {
    const job = {
      jobTitle: "Backend Tech Lead",
      company: "Stripe",
      seniorityLevel: "LEAD",
      roleSummary: "Lead payments infrastructure team",
      requiredSkills: ["Node.js", "PostgreSQL"],
      preferredSkills: ["Kafka"],
      coreResponsibilities: ["Design transaction systems"],
      domainKeywords: ["FinTech", "PCI-DSS", "High Availability"],
    };

    const parsed = JobAnalysisSchema.safeParse(job);
    expect(parsed.success).toBe(true);
  });
});
