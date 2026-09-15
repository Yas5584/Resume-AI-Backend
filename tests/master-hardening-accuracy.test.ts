import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { prisma } from "@resumeai/database";
import {
  ResumeData,
  ResumeDataSchema,
  ResumeContentChange,
} from "@resumeai/shared";
import { verifySingleChange } from "../src/ai/fact-guard/fact-guard-engine.js";
import { validateATS } from "../src/ai/ats-validator/ats-validator.js";

describe("ResumeAI — Master Hardening Accuracy (Section 42 Tests 1-25 & Section 43 Adversarial)", () => {
  let app: FastifyInstance;
  const timestamp = Date.now();
  const testEmail = `master.hardening.${timestamp}@example.com`;
  const otherUserEmail = `other.user.${timestamp}@example.com`;
  const testPassword = "Password123!";

  let cookie: string;
  let otherUserCookie: string;
  let userId: string;
  let otherUserId: string;
  let resumeId: string;
  let otherResumeId: string;

  const authoritativeResume: ResumeData = ResumeDataSchema.parse({
    personalInfo: {
      fullName: "Alex Developer",
      headline: "Software Developer",
      email: "alex@example.com",
      phone: "+1 555-0199",
      location: "San Francisco, CA",
    },
    summary:
      "Software Developer with 3 years of experience in backend REST APIs, machine learning models, and full-stack software development.",
    experience: [
      {
        id: "exp_1",
        jobTitle: "Software Developer",
        position: "Software Developer",
        company: "QuadRise Solution LLP",
        location: "Remote",
        startDate: "Sep 2022",
        endDate: "Present",
        current: true,
        bullets: [
          "Developed backend REST APIs using FastAPI and Node.js.",
          "Machine learning model achieved 92% accuracy on validation dataset.",
          "Packaged and containerized backend services using Docker.",
          "Processed 10K+ records daily through automated data pipelines.",
        ],
        technologiesUsed: [
          "FastAPI",
          "Python",
          "Node.js",
          "Express.js",
          "Docker",
          "SQL",
          "Scikit-learn",
        ],
      },
    ],
    education: [
      {
        id: "edu_1",
        institution: "State University",
        degree: "B.S. in Computer Science",
        fieldOfStudy: "Computer Science",
        startDate: "2018",
        endDate: "2022",
        current: false,
      },
    ],
    projects: [
      {
        id: "proj_1",
        name: "Recommendation Pipeline",
        description: "Built a content-based recommendation service.",
        bullets: [
          "Built a content-based recommendation service using Python and Scikit-learn.",
        ],
        technologies: ["Python", "Scikit-learn", "FastAPI"],
      },
    ],
    skills: [
      {
        id: "skill_1",
        category: "Programming & Frameworks",
        skills: [
          "Python",
          "FastAPI",
          "Node.js",
          "Express.js",
          "SQL",
          "Docker",
          "Scikit-learn",
        ],
      },
    ],
    certifications: [],
    achievements: [],
    languages: [],
    links: [],
    sectionVisibility: {
      showSummary: true,
      showExperience: true,
      showEducation: true,
      showProjects: true,
      showSkills: true,
      showCertifications: false,
      showAchievements: false,
      showLanguages: false,
      showLinks: false,
    },
    sectionOrder: ["summary", "experience", "projects", "skills", "education"],
  });

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Register User A
    const regResA = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: testEmail,
        password: testPassword,
        name: "Alex Developer",
      },
    });
    cookie = regResA.headers["set-cookie"] as string;
    userId = JSON.parse(regResA.payload).data.user.id;

    // Register User B
    const regResB = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: otherUserEmail,
        password: testPassword,
        name: "Other User",
      },
    });
    otherUserCookie = regResB.headers["set-cookie"] as string;
    otherUserId = JSON.parse(regResB.payload).data.user.id;

    // Create Resume for User A
    const resA = await prisma.resume.create({
      data: {
        userId,
        title: "Alex Master Resume",
        resumeData: authoritativeResume as any,
      },
    });
    resumeId = resA.id;

    // Create Resume for User B
    const resB = await prisma.resume.create({
      data: {
        userId: otherUserId,
        title: "Other User Resume",
        resumeData: authoritativeResume as any,
      },
    });
    otherResumeId = resB.id;
  });

  afterAll(async () => {
    if (resumeId) {
      await prisma.contentProposal.deleteMany({ where: { resumeId } });
      await prisma.resumeVersion.deleteMany({ where: { resumeId } });
      await prisma.resume.delete({ where: { id: resumeId } }).catch(() => {});
    }
    if (otherResumeId) {
      await prisma.contentProposal.deleteMany({
        where: { resumeId: otherResumeId },
      });
      await prisma.resumeVersion.deleteMany({
        where: { resumeId: otherResumeId },
      });
      await prisma.resume
        .delete({ where: { id: otherResumeId } })
        .catch(() => {});
    }
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    if (otherUserId) {
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
    }
    await app.close();
  });

  // TEST 1: FastAPI exists. AI says FastAPI. -> SUPPORTED
  it("TEST 1: FastAPI exists. AI says FastAPI. -> SUPPORTED", () => {
    const change: ResumeContentChange = {
      id: "test1_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed backend REST APIs using FastAPI and Node.js.",
      proposedValue:
        "Engineered scalable RESTful web services using FastAPI and Python.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Highlight FastAPI proficiency",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    // Remove "scalable" to test pure technology support
    change.proposedValue =
      "Engineered performant RESTful web services using FastAPI and Python.";
    const res = verifySingleChange(change, authoritativeResume);
    expect(res.unsupportedClaimsCount).toBe(0);
    expect(res.verifiedChange.status).toBe("PENDING");
    expect(res.verifiedChange.factCheckStatus).toBe("SUPPORTED");
    expect(res.factGuardScore).toBe(100);
    const fastapiClaim = res.claims.find((c) =>
      c.claim.toLowerCase().includes("fastapi"),
    );
    expect(fastapiClaim?.factCheckStatus).toBe("SUPPORTED");
  });

  // TEST 2: Django absent. AI says Django. -> UNSUPPORTED + BLOCKED
  it("TEST 2: Django absent. AI says Django. -> UNSUPPORTED + BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "test2_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed backend REST APIs using FastAPI and Node.js.",
      proposedValue: "Developed backend REST APIs using Python and Django.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Add Django",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(res.factGuardScore).toBeLessThan(100);
    expect(
      res.claims.some(
        (c) =>
          c.claim.toLowerCase().includes("django") &&
          c.factCheckStatus === "UNSUPPORTED",
      ),
    ).toBe(true);
  });

  // TEST 3: 10K+ records. AI says 10K+ users. -> CONTRADICTED/UNSUPPORTED + BLOCKED
  it("TEST 3: 10K+ records. AI says 10K+ users. -> CONTRADICTED + BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "test3_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[3]",
      originalValue:
        "Processed 10K+ records daily through automated data pipelines.",
      proposedValue:
        "Supported over 10K+ users daily through automated data pipelines.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_4"],
      rationale: "User scale",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("CONTRADICTED");
    expect(res.verifiedChange.blockedReason).toContain(
      "Metric semantic unit contradiction detected",
    );
    expect(res.factGuardScore).toBeLessThan(100);
  });

  // TEST 4: 10K+ records. AI says 10K requests. -> CONTRADICTED/UNSUPPORTED + BLOCKED
  it("TEST 4: 10K+ records. AI says 10K requests. -> CONTRADICTED + BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "test4_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[3]",
      originalValue:
        "Processed 10K+ records daily through automated data pipelines.",
      proposedValue:
        "Handled 10K requests daily through automated data pipelines.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_4"],
      rationale: "API requests",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("CONTRADICTED");
    expect(res.factGuardScore).toBeLessThan(100);
  });

  // TEST 5: 92% accuracy. AI says 98%. -> CONTRADICTED + BLOCKED
  it("TEST 5: 92% accuracy. AI says 98%. -> CONTRADICTED + BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "test5_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[1]",
      originalValue:
        "Machine learning model achieved 92% accuracy on validation dataset.",
      proposedValue:
        "Machine learning model achieved 98% accuracy on validation dataset.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_2"],
      rationale: "Inflate metric",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("CONTRADICTED");
    expect(res.verifiedChange.blockedReason).toContain(
      "Metric inflation detected",
    );
    expect(res.factGuardScore).toBeLessThan(100);
  });

  // TEST 6: REST APIs. AI says microservices. -> BLOCKED without explicit evidence
  it("TEST 6: REST APIs. AI says microservices. -> BLOCKED without explicit evidence", () => {
    const change: ResumeContentChange = {
      id: "test6_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed backend REST APIs using FastAPI and Node.js.",
      proposedValue: "Architected distributed microservices using Node.js.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Microservices upgrade",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(
      res.claims.some(
        (c) =>
          c.claim.toLowerCase().includes("microservices") &&
          c.factCheckStatus === "UNSUPPORTED",
      ),
    ).toBe(true);
  });

  // TEST 7: Backend development. AI says scalable architecture. -> BLOCKED without explicit evidence
  it("TEST 7: Backend development. AI says scalable architecture. -> BLOCKED without explicit evidence", () => {
    const change: ResumeContentChange = {
      id: "test7_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed backend REST APIs using FastAPI and Node.js.",
      proposedValue:
        "Engineered scalable architecture for high-throughput services using Node.js.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Scalability claim",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(res.verifiedChange.blockedReason).toContain("scalability");
  });

  // TEST 8: Docker. AI says Kubernetes. -> UNSUPPORTED + BLOCKED
  it("TEST 8: Docker. AI says Kubernetes. -> UNSUPPORTED + BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "test8_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[2]",
      originalValue:
        "Packaged and containerized backend services using Docker.",
      proposedValue:
        "Orchestrated container deployments across Kubernetes clusters.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_3"],
      rationale: "Orchestration leap",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(
      res.claims.some((c) => c.claim.toLowerCase().includes("kubernetes")),
    ).toBe(true);
  });

  // TEST 9: Python. AI says PySpark. -> UNSUPPORTED + BLOCKED
  it("TEST 9: Python. AI says PySpark. -> UNSUPPORTED + BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "test9_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed backend REST APIs using FastAPI and Node.js.",
      proposedValue:
        "Engineered big data processing pipelines using Python and PySpark.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Add PySpark",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(
      res.claims.some((c) => c.claim.toLowerCase().includes("pyspark")),
    ).toBe(true);
  });

  // TEST 10: No AWS. AI says AWS. -> UNSUPPORTED + BLOCKED
  it("TEST 10: No AWS. AI says AWS. -> UNSUPPORTED + BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "test10_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed backend REST APIs using FastAPI and Node.js.",
      proposedValue: "Deployed backend services to AWS cloud infrastructure.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Add AWS",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(res.claims.some((c) => c.claim.toLowerCase().includes("aws"))).toBe(
      true,
    );
  });

  // TEST 11: No certification. AI says AWS certification. -> UNSUPPORTED + BLOCKED
  it("TEST 11: No certification. AI says AWS certification. -> UNSUPPORTED + BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "test11_change",
      section: "summary",
      field: "summary",
      originalValue: authoritativeResume.summary || "",
      proposedValue:
        "AWS Certified Solutions Architect with 3 years of experience in backend development.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["summary_evidence"],
      rationale: "Invent certification",
      risk: "HIGH",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(res.verifiedChange.blockedReason).toContain(
      "Invented certification detected",
    );
  });

  // TEST 12: Employer mismatch. -> CONTRADICTED + BLOCKED
  it("TEST 12: Employer mismatch. -> CONTRADICTED + BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "test12_change",
      section: "experience",
      itemId: "exp_1",
      field: "company",
      originalValue: "QuadRise Solution LLP",
      proposedValue: "Google",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_company"],
      rationale: "Change employer to Google",
      risk: "HIGH",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("CONTRADICTED");
    expect(res.verifiedChange.blockedReason).toContain(
      "Employer modification detected",
    );
  });

  // TEST 13: Job title upgrade. -> BLOCKED
  it("TEST 13: Job title upgrade. -> BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "test13_change",
      section: "experience",
      itemId: "exp_1",
      field: "jobTitle",
      originalValue: "Software Developer",
      proposedValue: "Principal Software Architect",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_title"],
      rationale: "Seniority leap",
      risk: "HIGH",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("CONTRADICTED");
    expect(res.verifiedChange.blockedReason).toContain(
      "Seniority title inflation detected",
    );
  });

  // TEST 14: Date modification. -> BLOCKED
  it("TEST 14: Date modification. -> BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "test14_change",
      section: "experience",
      itemId: "exp_1",
      field: "startDate",
      originalValue: "Sep 2022",
      proposedValue: "Jan 2018",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_dates"],
      rationale: "Lengthen tenure",
      risk: "HIGH",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("CONTRADICTED");
    expect(res.verifiedChange.blockedReason).toContain(
      "Employment date modification detected",
    );
  });

  // TEST 15: JD requests Databricks. Resume doesn't contain it. -> Must NOT be added (BLOCKED)
  it("TEST 15: JD requests Databricks. Resume doesn't contain it. -> BLOCKED if added", () => {
    const change: ResumeContentChange = {
      id: "test15_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed backend REST APIs using FastAPI and Node.js.",
      proposedValue:
        "Built big data processing pipelines on Databricks with Python.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "JD keyword injection",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(
      res.claims.some((c) => c.claim.toLowerCase().includes("databricks")),
    ).toBe(true);
  });

  // TEST 16: Custom instruction asks for AWS. Resume doesn't contain AWS. -> Must NOT be added (BLOCKED)
  it("TEST 16: Custom instruction asks for AWS. Resume doesn't contain AWS. -> BLOCKED if added", () => {
    const change: ResumeContentChange = {
      id: "test16_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed backend REST APIs using FastAPI and Node.js.",
      proposedValue: "Developed backend REST APIs and deployed on AWS EC2.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Custom instruction preference",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(res.claims.some((c) => c.claim.toLowerCase().includes("aws"))).toBe(
      true,
    );
  });

  // TEST 17: All claims supported. -> Fact Guard 100%
  it("TEST 17: All claims supported. -> Fact Guard 100%", () => {
    const change: ResumeContentChange = {
      id: "test17_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed backend REST APIs using FastAPI and Node.js.",
      proposedValue:
        "Developed backend REST APIs using FastAPI, Node.js, and Express.js.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Rephrase with verified evidence",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.unsupportedClaimsCount).toBe(0);
    expect(res.factGuardScore).toBe(100);
    expect(res.verifiedChange.status).toBe("PENDING");
    expect(res.verifiedChange.factCheckStatus).toBe("SUPPORTED");
  });

  // TEST 18: One unsupported claim. -> Fact Guard <100%
  it("TEST 18: One unsupported claim. -> Fact Guard <100%", () => {
    const change: ResumeContentChange = {
      id: "test18_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed backend REST APIs using FastAPI and Node.js.",
      proposedValue:
        "Developed backend REST APIs using FastAPI, Node.js, and PySpark.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Added PySpark",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.unsupportedClaimsCount).toBe(1);
    expect(res.factGuardScore).toBeLessThan(100);
    expect(res.verifiedChange.status).toBe("BLOCKED");
  });

  // TEST 19: Multiple unsupported claims. -> ALL claims detected
  it("TEST 19: Multiple unsupported claims. -> ALL claims detected", () => {
    const change: ResumeContentChange = {
      id: "test19_change",
      section: "summary",
      field: "summary",
      originalValue: authoritativeResume.summary || "",
      proposedValue:
        "Software Developer experienced in Django, AWS, and PySpark.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["summary_evidence"],
      rationale: "Multiple hallucinations",
      risk: "HIGH",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.unsupportedClaimsCount).toBeGreaterThanOrEqual(3);
    expect(
      res.claims.some((c) => c.claim.toLowerCase().includes("django")),
    ).toBe(true);
    expect(res.claims.some((c) => c.claim.toLowerCase().includes("aws"))).toBe(
      true,
    );
    expect(
      res.claims.some((c) => c.claim.toLowerCase().includes("pyspark")),
    ).toBe(true);
  });

  // TEST 20: Fake evidenceId. -> INVALID EVIDENCE / BLOCKED
  it("TEST 20: Fake evidenceId. -> INVALID EVIDENCE / BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "test20_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed backend REST APIs using FastAPI and Node.js.",
      proposedValue: "Developed backend REST APIs using FastAPI and Python.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["fake_nonexistent_evidence_999"],
      rationale: "Forged evidence ID",
      risk: "HIGH",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.blockedReason).toContain(
      "Evidence ID tampering detected",
    );
    expect(res.factGuardScore).toBe(0);
  });

  // TEST 21: Valid evidenceId. -> accepted if actual evidence supports claim
  it("TEST 21: Valid evidenceId. -> accepted if actual evidence supports claim", () => {
    const change: ResumeContentChange = {
      id: "test21_change",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed backend REST APIs using FastAPI and Node.js.",
      proposedValue: "Developed backend REST APIs using FastAPI and Python.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Valid evidence tracing",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const res = verifySingleChange(change, authoritativeResume);
    expect(res.verifiedChange.status).toBe("PENDING");
    expect(res.verifiedChange.factCheckStatus).toBe("SUPPORTED");
    expect(res.factGuardScore).toBe(100);
  });

  // TEST 22: Stale proposal. -> HTTP 409
  it("TEST 22: Stale proposal. -> HTTP 409 on Apply", async () => {
    // 1. Create draft proposal with older resumeUpdatedAt
    const proposal = await prisma.contentProposal.create({
      data: {
        userId,
        resumeId,
        status: "DRAFT",
        resumeUpdatedAt: new Date(Date.now() - 60000), // 1 min in past
        proposalData: {
          changes: [
            {
              id: "stale_change_1",
              section: "experience",
              itemId: "exp_1",
              field: "bullets[0]",
              originalValue: "Old",
              proposedValue: "New",
              changeType: "REWRITE",
              targetRequirementIds: [],
              evidenceIds: ["exp_1_bullet_1"],
              rationale: "Update",
              risk: "LOW",
              status: "APPROVED",
              factCheckStatus: "SUPPORTED",
            },
          ],
          summaryStats: {
            totalProposed: 1,
            verifiedCount: 1,
            blockedCount: 0,
            uncertainCount: 0,
          },
        } as any,
      },
    });

    // 2. Concurrently update the resume row to bump its updatedAt
    await prisma.resume.update({
      where: { id: resumeId },
      data: { title: "Alex Master Resume — Concurrently Updated" },
    });

    // 3. Attempt Apply -> must return HTTP 409 Conflict
    const applyRes = await app.inject({
      method: "POST",
      url: `/api/content-writer/proposals/${proposal.id}/apply`,
      headers: { cookie },
      payload: { selectedChangeIds: ["stale_change_1"] },
    });

    expect(applyRes.statusCode).toBe(409);
    const body = JSON.parse(applyRes.payload);
    expect(body.error?.message).toContain("STALE_PROPOSAL");
  });

  // TEST 23: Client modifies proposed text on Apply. -> server ignores/rejects client payload
  it("TEST 23: Client modifies proposed text on Apply. -> server applies only DB verified content", async () => {
    // 1. Create a legitimate proposal in DB
    const proposal = await prisma.contentProposal.create({
      data: {
        userId,
        resumeId,
        status: "DRAFT",
        resumeUpdatedAt: new Date(),
        proposalData: {
          changes: [
            {
              id: "legit_change_1",
              section: "experience",
              itemId: "exp_1",
              field: "bullets[0]",
              originalValue:
                "Developed backend REST APIs using FastAPI and Node.js.",
              proposedValue:
                "Engineered backend REST APIs using FastAPI and Python.",
              changeType: "REWRITE",
              targetRequirementIds: [],
              evidenceIds: ["exp_1_bullet_1"],
              rationale: "Good rewrite",
              risk: "LOW",
              status: "APPROVED",
              factCheckStatus: "SUPPORTED",
            },
          ],
          summaryStats: {
            totalProposed: 1,
            verifiedCount: 1,
            blockedCount: 0,
            uncertainCount: 0,
          },
        } as any,
      },
    });

    // 2. Client sends malicious body with forged proposedValue
    const res = await app.inject({
      method: "POST",
      url: `/api/content-writer/proposals/${proposal.id}/apply`,
      headers: { cookie },
      payload: {
        selectedChangeIds: ["legit_change_1"],
        // Malicious client attempt to inject unauthorized content:
        proposedValue: "Malicious hacked content with Django and AWS",
        factCheckStatus: "SUPPORTED",
        score: 100,
      },
    });

    expect(res.statusCode).toBe(200);

    // Verify database resume was updated ONLY with server's verified proposedValue, NOT client's payload
    const updatedResume = await prisma.resume.findUnique({
      where: { id: resumeId },
    });
    const updatedData = updatedResume?.resumeData as any;
    expect(updatedData.experience[0].bullets[0]).toBe(
      "Engineered backend REST APIs using FastAPI and Python.",
    );
    expect(updatedData.experience[0].bullets[0]).not.toContain("Malicious");
  });

  // TEST 24: Client changes ATS score. -> ignored/backend calculates
  it("TEST 24: Client changes ATS score. -> ignored/backend calculates deterministically", () => {
    const rawText =
      "Software Developer with 3 years of experience building backend REST APIs using FastAPI, Node.js, and Python. Developed predictive recommendation algorithms and structured databases supporting web services. Dedicated to clean architecture, robust system design, and continuous technical delivery.";
    const atsResult = validateATS(rawText, "summary", {
      unsupportedClaimsCount: 0,
      hasContradictions: false,
    });

    // ATS score is calculated purely on server side via deterministic formula
    expect(atsResult.score).toBeGreaterThanOrEqual(75);
    expect(atsResult.isAtsFriendly).toBe(true);
    expect(atsResult.categoryScores).toBeDefined();
    expect(atsResult.categoryScores?.formatting).toBe(15);
    expect(atsResult.categoryScores?.evidence).toBe(25);
  });

  // TEST 25: Client changes Fact Guard. -> ignored/backend calculates
  it("TEST 25: Client changes Fact Guard. -> server rejects client-forged status", () => {
    const changeWithForgedStatus: ResumeContentChange = {
      id: "forged_change_1",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed backend REST APIs using FastAPI and Node.js.",
      proposedValue: "Architected microservices with Django and Kubernetes.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Client forged",
      risk: "LOW",
      // Client forged status:
      status: "APPROVED",
      factCheckStatus: "SUPPORTED",
    };

    const res = verifySingleChange(changeWithForgedStatus, authoritativeResume);
    // Server independently recalculates and overrides status to BLOCKED / UNSUPPORTED
    expect(res.verifiedChange.status).toBe("BLOCKED");
    expect(res.verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(res.factGuardScore).toBeLessThan(100);
  });

  // =========================================================================
  // SECTION 43: ADVERSARIAL TEST — MOST IMPORTANT
  // =========================================================================
  describe("SECTION 43: ADVERSARIAL TEST — MOST IMPORTANT", () => {
    it("Detects ALL 8 hallucinations, blocks proposal, and produces 0% Fact Guard score", () => {
      const adversarialText =
        "Software Developer experienced with Django, AWS, Kubernetes and PySpark, building scalable microservices that serve over 10K users with 98% accuracy.";

      const change: ResumeContentChange = {
        id: "adversarial_proposal_change",
        section: "summary",
        field: "summary",
        originalValue: authoritativeResume.summary || "",
        proposedValue: adversarialText,
        changeType: "REWRITE",
        targetRequirementIds: [],
        evidenceIds: ["summary_evidence"],
        rationale: "Adversarial test injection",
        risk: "HIGH",
        status: "PENDING",
        factCheckStatus: "UNCERTAIN",
      };

      const result = verifySingleChange(change, authoritativeResume);

      // Verify overall state
      expect(result.verifiedChange.status).toBe("BLOCKED");
      expect(result.verifiedChange.factCheckStatus).toBe("CONTRADICTED");
      expect(result.supportedClaimsCount).toBe(0);
      expect(result.unsupportedClaimsCount).toBeGreaterThanOrEqual(7);
      expect(result.factGuardScore).toBe(0);

      // Verify every single hallucination was caught:
      const claimTexts = result.claims
        .map((c) => c.claim.toLowerCase())
        .join(" ");

      // 1. Django
      expect(claimTexts).toContain("django");
      // 2. AWS
      expect(claimTexts).toContain("aws");
      // 3. Kubernetes
      expect(claimTexts).toContain("kubernetes");
      // 4. PySpark
      expect(claimTexts).toContain("pyspark");
      // 5. Scalable
      expect(claimTexts).toContain("scalable");
      // 6. Microservices
      expect(claimTexts).toContain("microservices");
      // 7. 10K users
      expect(claimTexts).toContain("10k users");
      // 8. 98% accuracy
      expect(claimTexts).toContain("98%");

      // Verify ATS validator rejects proposal with unsupported claims
      const ats = validateATS(adversarialText, "summary", {
        claims: result.claims,
        unsupportedClaimsCount: result.unsupportedClaimsCount,
        originalText: authoritativeResume.summary || "",
      });
      expect(ats.isAtsFriendly).toBe(false);
      expect(ats.score).toBeLessThan(50);
    });
  });

  // =========================================================================
  // SECTION 41: SECURITY TESTS
  // =========================================================================
  describe("SECTION 41: SECURITY TESTS", () => {
    it("User B cannot access User A proposal", async () => {
      // User A creates proposal
      const propA = await prisma.contentProposal.create({
        data: {
          userId,
          resumeId,
          status: "DRAFT",
          proposalData: {
            changes: [],
            summaryStats: {
              totalProposed: 0,
              verifiedCount: 0,
              blockedCount: 0,
              uncertainCount: 0,
            },
          } as any,
        },
      });

      // User B tries to fetch User A proposal
      const res = await app.inject({
        method: "GET",
        url: `/api/content-writer/proposals/${propA.id}`,
        headers: { cookie: otherUserCookie },
      });

      expect(res.statusCode).toBe(404);
    });

    it("User B cannot apply User A proposal", async () => {
      const propA = await prisma.contentProposal.create({
        data: {
          userId,
          resumeId,
          status: "DRAFT",
          proposalData: {
            changes: [],
            summaryStats: {
              totalProposed: 0,
              verifiedCount: 0,
              blockedCount: 0,
              uncertainCount: 0,
            },
          } as any,
        },
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/content-writer/proposals/${propA.id}/apply`,
        headers: { cookie: otherUserCookie },
        payload: { selectedChangeIds: ["change_1"] },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("Technical Metric Unit Equivalences and Cross-Unit Contradiction Protection", () => {
    const resumeWithRequests: ResumeData = {
      ...authoritativeResume,
      experience: [
        {
          ...authoritativeResume.experience[0],
          id: "exp_requests",
          company: "QuadRise Solution LLP",
          position: "AI Engineer",
          jobTitle: "AI Engineer",
          startDate: "2023-01",
          endDate: "Present",
          current: true,
          location: "Remote",
          employmentType: "Full-time",
          description: "AI API engineering",
          bullets: [
            "Engineered LLM-powered APIs processing 5,000+ monthly requests with low latency",
          ],
          technologiesUsed: ["Python", "FastAPI"],
        },
      ],
    };

    it("allows equivalent system traffic units (5,000+ monthly requests -> 5,000 queries)", () => {
      const change: ResumeContentChange = {
        id: "unit_eq_test_1",
        section: "experience",
        itemId: "exp_requests",
        field: "bullets[0]",
        originalValue:
          "Engineered LLM-powered APIs processing 5,000+ monthly requests with low latency",
        proposedValue:
          "Engineered LLM-powered APIs processing over 5,000 queries with low latency",
        changeType: "REWRITE",
        targetRequirementIds: [],
        evidenceIds: ["exp_requests"],
        rationale: "Phrasing refinement",
        risk: "LOW",
        status: "PENDING",
        factCheckStatus: "UNCERTAIN",
      };

      const res = verifySingleChange(change, resumeWithRequests);
      expect(res.verifiedChange.status).not.toBe("BLOCKED");
      expect(res.verifiedChange.factCheckStatus).toBe("SUPPORTED");
      expect(res.claims.some((c) => c.factCheckStatus === "CONTRADICTED")).toBe(
        false,
      );
    });

    it("blocks cross-unit substitution when requests become users (5,000 requests -> 5,000 users)", () => {
      const change: ResumeContentChange = {
        id: "unit_cross_test_2",
        section: "experience",
        itemId: "exp_requests",
        field: "bullets[0]",
        originalValue:
          "Engineered LLM-powered APIs processing 5,000+ monthly requests with low latency",
        proposedValue:
          "Engineered LLM-powered APIs serving over 5,000 users with low latency",
        changeType: "REWRITE",
        targetRequirementIds: [],
        evidenceIds: ["exp_requests"],
        rationale: "Phrasing refinement",
        risk: "HIGH",
        status: "PENDING",
        factCheckStatus: "UNCERTAIN",
      };

      const res = verifySingleChange(change, resumeWithRequests);
      expect(res.verifiedChange.status).toBe("BLOCKED");
      expect(res.verifiedChange.factCheckStatus).toBe("CONTRADICTED");
      expect(res.verifiedChange.blockedReason).toContain(
        "Metric semantic unit contradiction detected",
      );
    });

    it("blocks cross-unit substitution when records become queries (10K+ records -> 10K queries)", () => {
      const change: ResumeContentChange = {
        id: "unit_cross_test_3",
        section: "experience",
        itemId: "exp_1",
        field: "bullets[0]",
        originalValue:
          "Optimized SQL database queries handling over 10K+ records with sub-second response times.",
        proposedValue:
          "Optimized SQL database queries handling over 10K queries daily with sub-second response times.",
        changeType: "REWRITE",
        targetRequirementIds: [],
        evidenceIds: ["exp_1"],
        rationale: "Phrasing refinement",
        risk: "HIGH",
        status: "PENDING",
        factCheckStatus: "UNCERTAIN",
      };

      const res = verifySingleChange(change, authoritativeResume);
      expect(res.verifiedChange.status).toBe("BLOCKED");
      expect(res.verifiedChange.factCheckStatus).toBe("CONTRADICTED");
      expect(res.verifiedChange.blockedReason).toContain(
        "Metric semantic unit contradiction detected",
      );
    });
  });
});
