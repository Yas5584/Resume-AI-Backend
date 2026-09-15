import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { prisma } from "@resumeai/database";
import {
  ResumeData,
  ResumeDataSchema,
  JobAnalysis,
  ResumeContentChange,
} from "@resumeai/shared";
import { verifySingleChange } from "../src/ai/fact-guard/fact-guard-engine.js";
import { validateATS } from "../src/ai/ats-validator/ats-validator.js";

describe("ResumeAI — Critical AI Regeneration Accuracy & Factual Grounding (13 Required Tests)", () => {
  let app: FastifyInstance;
  const timestamp = Date.now();
  const testEmail = `factual.tester.${timestamp}@example.com`;
  const testPassword = "Password123!";

  let cookie: string;
  let userId: string;
  let resumeId: string;
  let jobId: string;

  const baseResumeData: ResumeData = ResumeDataSchema.parse({
    personalInfo: {
      fullName: "Yash Sharma",
      headline: "Software Developer",
      email: "yash@example.com",
      phone: "+91 9876543210",
      location: "India",
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
          "Developed REST APIs using Node.js.",
          "Machine learning model achieved 92% accuracy on production dataset.",
          "Packaged and containerized applications using Docker.",
          "Processed 10K+ records daily through automated data pipelines.",
        ],
        technologiesUsed: [
          "Node.js",
          "Express.js",
          "Python",
          "SQL",
          "Docker",
          "Scikit-learn",
        ],
      },
    ],
    education: [
      {
        id: "edu_1",
        institution: "University of Tech",
        degree: "Bachelor of Technology",
        fieldOfStudy: "Computer Science",
        startDate: "2018",
        endDate: "2022",
        current: false,
      },
    ],
    projects: [
      {
        id: "proj_1",
        name: "Movie Recommender System",
        description:
          "Built a content-based movie recommender using Bag of Words and CountVectorizer.",
        bullets: [
          "Built a content-based movie recommender using Bag of Words and CountVectorizer.",
        ],
        technologies: ["Python", "Scikit-learn", "Flask"],
      },
    ],
    skills: [
      {
        id: "skill_1",
        category: "Programming Languages",
        skills: ["Python", "JavaScript", "SQL", "Node.js", "Express.js"],
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

  const targetJobAnalysis: JobAnalysis = {
    jobTitle: "Senior Big Data Engineer",
    company: "DataScale Inc",
    seniority: "SENIOR",
    summary:
      "Looking for an engineer with Databricks, PySpark, and distributed systems experience.",
    skills: [
      {
        name: "Databricks",
        normalizedName: "databricks",
        category: "REQUIRED_SKILL",
        importance: "REQUIRED",
        explicit: true,
        evidence: "Databricks platform required",
        confidence: 1.0,
      },
      {
        name: "Python",
        normalizedName: "python",
        category: "REQUIRED_SKILL",
        importance: "REQUIRED",
        explicit: true,
        evidence: "Python required",
        confidence: 1.0,
      },
    ],
    responsibilities: [],
    requirements: [],
    education: [],
    certifications: [],
    experience: [],
    keywords: [],
    workArrangement: "REMOTE",
    location: null,
    industry: null,
    workAuthorization: null,
    roleSummary: "Big data engineering position requiring Databricks.",
    requiredSkills: ["Databricks", "Python"],
    preferredSkills: ["PySpark", "Kubernetes"],
    experienceYearsMinimum: 5,
  };

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Register User
    const regRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: testEmail,
        password: testPassword,
        name: "Yash Sharma",
      },
    });
    cookie = regRes.headers["set-cookie"] as string;
    userId = JSON.parse(regRes.payload).data.user.id;

    // Create Resume in DB
    const resume = await prisma.resume.create({
      data: {
        userId,
        title: "Test Grounding Resume",
        resumeData: baseResumeData as any,
      },
    });
    resumeId = resume.id;

    // Create Target Job in DB
    const job = await prisma.jobDescription.create({
      data: {
        userId,
        title: "Senior Big Data Engineer",
        company: "DataScale Inc",
        rawText:
          "Job requiring Databricks, Python, and PySpark for big data pipeline development.",
        status: "COMPLETED",
        parsedData: targetJobAnalysis as any,
      },
    });
    jobId = job.id;
  });

  afterAll(async () => {
    if (resumeId) {
      await prisma.contentProposal.deleteMany({ where: { resumeId } });
      await prisma.resumeVersion.deleteMany({ where: { resumeId } });
      await prisma.resume.delete({ where: { id: resumeId } }).catch(() => {});
    }
    if (jobId) {
      await prisma.jobDescription
        .delete({ where: { id: jobId } })
        .catch(() => {});
    }
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await app.close();
  });

  // =========================================================================
  // TEST 1: Resume contains Python. AI writes Python. -> SUPPORTED
  // =========================================================================
  it("TEST 1: Resume contains Python. AI writes Python -> SUPPORTED", () => {
    const change: ResumeContentChange = {
      id: "change_test_1",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed REST APIs using Node.js.",
      proposedValue: "Engineered backend data solutions using Python and SQL.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Align with candidate's evidenced Python and SQL skills",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const { verifiedChange, factGuardScore, unsupportedClaimsCount } =
      verifySingleChange(change, baseResumeData);

    expect(unsupportedClaimsCount).toBe(0);
    expect(verifiedChange.factCheckStatus).toBe("SUPPORTED");
    expect(verifiedChange.status).toBe("PENDING");
    expect(factGuardScore).toBe(100);
  });

  // =========================================================================
  // TEST 2: Resume contains Python. AI writes Django. -> UNSUPPORTED / BLOCKED
  // =========================================================================
  it("TEST 2: Resume contains Python. AI writes Django -> UNSUPPORTED / BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "change_test_2",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed REST APIs using Node.js.",
      proposedValue: "Engineered web applications using Python and Django.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Introduce web framework",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const { verifiedChange, claims, factGuardScore, unsupportedClaimsCount } =
      verifySingleChange(change, baseResumeData);

    expect(unsupportedClaimsCount).toBeGreaterThan(0);
    expect(verifiedChange.status).toBe("BLOCKED");
    expect(verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(verifiedChange.blockedReason).toContain(
      "Unsupported technology detected",
    );
    expect(verifiedChange.blockedReason).toContain("django");
    expect(factGuardScore).toBeLessThan(100);

    const djangoClaim = claims.find((c) =>
      c.claim.toLowerCase().includes("django"),
    );
    expect(djangoClaim).toBeDefined();
    expect(djangoClaim?.factCheckStatus).toBe("UNSUPPORTED");
  });

  // =========================================================================
  // TEST 3: Resume contains REST APIs. AI writes microservices. -> UNSUPPORTED
  // =========================================================================
  it("TEST 3: Resume contains REST APIs. AI writes microservices -> UNSUPPORTED unless explicit evidence exists", () => {
    const change: ResumeContentChange = {
      id: "change_test_3",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed REST APIs using Node.js.",
      proposedValue:
        "Architected and deployed scalable microservices to support mission-critical workflows.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Architectural leap to microservices",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const { verifiedChange, claims, factGuardScore } = verifySingleChange(
      change,
      baseResumeData,
    );

    expect(verifiedChange.status).toBe("BLOCKED");
    expect(verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(verifiedChange.blockedReason).toContain(
      "Unsupported technology detected",
    );
    expect(verifiedChange.blockedReason).toContain("microservices");
    expect(factGuardScore).toBeLessThan(100);

    const microClaim = claims.find((c) =>
      c.claim.toLowerCase().includes("microservices"),
    );
    expect(microClaim?.factCheckStatus).toBe("UNSUPPORTED");
  });

  // =========================================================================
  // TEST 4: Resume contains Docker. AI writes Kubernetes. -> UNSUPPORTED
  // =========================================================================
  it("TEST 4: Resume contains Docker. AI writes Kubernetes -> UNSUPPORTED", () => {
    const change: ResumeContentChange = {
      id: "change_test_4",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[2]",
      originalValue: "Packaged and containerized applications using Docker.",
      proposedValue:
        "Containerized core services using Docker and orchestrated deployments on Kubernetes clusters.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_3"],
      rationale: "Container orchestration leap",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const { verifiedChange, claims, factGuardScore } = verifySingleChange(
      change,
      baseResumeData,
    );

    expect(verifiedChange.status).toBe("BLOCKED");
    expect(verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(verifiedChange.blockedReason).toContain(
      "Unsupported technology detected",
    );
    expect(verifiedChange.blockedReason).toContain("kubernetes");
    expect(factGuardScore).toBeLessThan(100);

    const k8sClaim = claims.find((c) =>
      c.claim.toLowerCase().includes("kubernetes"),
    );
    expect(k8sClaim?.factCheckStatus).toBe("UNSUPPORTED");
  });

  // =========================================================================
  // TEST 5: JD contains Databricks. Resume does not contain Databricks.
  // AI must NOT add Databricks.
  // =========================================================================
  it("TEST 5: JD contains Databricks. Resume does not contain Databricks -> Fact Guard blocks Databricks addition", () => {
    const change: ResumeContentChange = {
      id: "change_test_5",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed REST APIs using Node.js.",
      proposedValue:
        "Engineered large-scale data transformation workflows using Databricks and Python.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Attempted alignment with target job Databricks requirement",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const { verifiedChange, claims, factGuardScore } = verifySingleChange(
      change,
      baseResumeData,
    );

    expect(verifiedChange.status).toBe("BLOCKED");
    expect(verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(verifiedChange.blockedReason).toContain("databricks");
    expect(factGuardScore).toBeLessThan(100);

    const databricksClaim = claims.find((c) =>
      c.claim.toLowerCase().includes("databricks"),
    );
    expect(databricksClaim?.factCheckStatus).toBe("UNSUPPORTED");
  });

  // =========================================================================
  // TEST 6: Resume contains ML project with measurable 92% accuracy.
  // AI preserves 92%. -> SUPPORTED
  // =========================================================================
  it("TEST 6: Resume contains ML project with measurable 92% accuracy. AI preserves 92% -> SUPPORTED", () => {
    const change: ResumeContentChange = {
      id: "change_test_6",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[1]",
      originalValue:
        "Machine learning model achieved 92% accuracy on production dataset.",
      proposedValue:
        "Engineered predictive machine learning models achieving 92% accuracy on validation datasets.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_2"],
      rationale: "Preserve verified accuracy metric",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const { verifiedChange, claims, factGuardScore, unsupportedClaimsCount } =
      verifySingleChange(change, baseResumeData);

    expect(unsupportedClaimsCount).toBe(0);
    expect(verifiedChange.factCheckStatus).toBe("SUPPORTED");
    expect(verifiedChange.status).toBe("PENDING");
    expect(factGuardScore).toBe(100);

    const metricClaim = claims.find((c) => c.claim.includes("92%"));
    expect(metricClaim).toBeDefined();
    expect(metricClaim?.factCheckStatus).toBe("SUPPORTED");
  });

  // =========================================================================
  // TEST 7: AI changes 92% to 97%. -> CONTRADICTED / BLOCKED
  // =========================================================================
  it("TEST 7: AI changes 92% to 97% -> CONTRADICTED / BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "change_test_7",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[1]",
      originalValue:
        "Machine learning model achieved 92% accuracy on production dataset.",
      proposedValue:
        "Engineered predictive machine learning models achieving 97% accuracy on validation datasets.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_2"],
      rationale: "Inflate model accuracy",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const { verifiedChange, claims, factGuardScore } = verifySingleChange(
      change,
      baseResumeData,
    );

    expect(verifiedChange.status).toBe("BLOCKED");
    expect(verifiedChange.factCheckStatus).toBe("CONTRADICTED");
    expect(verifiedChange.blockedReason).toContain("Metric inflation detected");
    expect(factGuardScore).toBeLessThan(100);

    const metricClaim = claims.find((c) => c.claim.includes("97%"));
    expect(metricClaim?.factCheckStatus).toBe("CONTRADICTED");
  });

  // =========================================================================
  // TEST 8: AI changes employment dates. -> BLOCKED
  // =========================================================================
  it("TEST 8: AI changes employment dates -> CONTRADICTED / BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "change_test_8",
      section: "experience",
      itemId: "exp_1",
      field: "startDate",
      originalValue: "Sep 2022",
      proposedValue: "Jan 2019",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_dates"],
      rationale: "Extend candidate tenure",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const { verifiedChange, claims, factGuardScore } = verifySingleChange(
      change,
      baseResumeData,
    );

    expect(verifiedChange.status).toBe("BLOCKED");
    expect(verifiedChange.factCheckStatus).toBe("CONTRADICTED");
    expect(verifiedChange.blockedReason).toContain(
      "Employment date modification detected",
    );
    expect(factGuardScore).toBeLessThan(100);

    const dateClaim = claims.find((c) => c.category === "EMPLOYMENT_DATES");
    expect(dateClaim?.factCheckStatus).toBe("CONTRADICTED");
  });

  // =========================================================================
  // TEST 9: AI changes job title. -> BLOCKED
  // =========================================================================
  it("TEST 9: AI changes job title to unearned seniority -> CONTRADICTED / BLOCKED", () => {
    const change: ResumeContentChange = {
      id: "change_test_9",
      section: "experience",
      itemId: "exp_1",
      field: "jobTitle",
      originalValue: "Software Developer",
      proposedValue: "Senior Software Engineer & Lead Architect",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_title"],
      rationale: "Inflate title to Senior Lead",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const { verifiedChange, claims, factGuardScore } = verifySingleChange(
      change,
      baseResumeData,
    );

    expect(verifiedChange.status).toBe("BLOCKED");
    expect(verifiedChange.factCheckStatus).toBe("CONTRADICTED");
    expect(verifiedChange.blockedReason).toContain(
      "Seniority title inflation detected",
    );
    expect(factGuardScore).toBeLessThan(100);

    const titleClaim = claims.find((c) => c.category === "JOB_TITLE");
    expect(titleClaim?.factCheckStatus).toBe("CONTRADICTED");
  });

  // =========================================================================
  // TEST 10: AI generates a 150-word summary. -> ATS validator flags excessive length
  // =========================================================================
  it("TEST 10: AI generates a 150-word summary -> ATS validator flags excessive length", () => {
    const verbose150WordSummary =
      "Experienced and results-driven Software Developer with a robust background in building reliable backend systems, web applications, and predictive machine learning models using Python, Node.js, and modern relational databases. Proven track record of developing performant REST APIs, optimizing backend query structures, and designing end-to-end recommendation algorithms that improve candidate and user satisfaction across diverse platforms. Adept at applying software design patterns, structured error handling, automated testing principles, and clean modular code standards across distributed development teams. Passionate about tackling complex algorithmic challenges, translating business logic into maintainable technical implementations, and collaborating closely with cross-functional stakeholders including product managers, UI engineers, and data analysts to deliver high-quality digital solutions. Committed to continuous technical improvement, agile development methodologies, rapid prototyping, and delivering measurable engineering outcomes that align with company goals and modern industry architecture best practices in scalable web development.";

    const wordCount = verbose150WordSummary.trim().split(/\s+/).length;
    expect(wordCount).toBeGreaterThanOrEqual(130);

    const atsResult = validateATS(verbose150WordSummary, "summary");

    const lengthCheck = atsResult.checks.find((c) =>
      c.name.includes("Summary Length"),
    );
    expect(lengthCheck).toBeDefined();
    expect(lengthCheck?.passed).toBe(false);
    expect(lengthCheck?.feedback).toContain("excessively long");
    expect(atsResult.isAtsFriendly).toBe(false);
  });

  // =========================================================================
  // TEST 11: AI generates 2–4 sentence summary with only supported facts. -> PASS
  // =========================================================================
  it("TEST 11: AI generates 2-4 sentence summary with only supported facts -> PASS", () => {
    const goodSummary =
      "Software Developer with 3 years of experience building scalable backend REST APIs and machine learning models using Node.js, Python, and SQL. Developed predictive recommendation algorithms and structured databases supporting high-availability web services. Dedicated to clean architecture, robust system design, and continuous technical delivery.";

    const atsResult = validateATS(goodSummary, "summary", {
      unsupportedClaimsCount: 0,
      hasContradictions: false,
    });

    const lengthCheck = atsResult.checks.find((c) =>
      c.name.includes("Summary Length"),
    );
    expect(lengthCheck?.passed).toBe(true);
    expect(
      atsResult.checks.find((c) =>
        c.name.includes("Candidate Evidence Coverage"),
      )?.passed,
    ).toBe(true);
    expect(atsResult.isAtsFriendly).toBe(true);
    expect(atsResult.score).toBeGreaterThanOrEqual(75);
  });

  // =========================================================================
  // TEST 12: All claims supported. -> Fact Guard = 100%
  // =========================================================================
  it("TEST 12: All claims supported -> Fact Guard = 100%", () => {
    const change: ResumeContentChange = {
      id: "change_test_12",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed REST APIs using Node.js.",
      proposedValue:
        "Developed backend REST APIs using Node.js and Express.js to support application functionality.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Natural ATS expansion using candidate's Express.js evidence",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const { verifiedChange, factGuardScore, unsupportedClaimsCount } =
      verifySingleChange(change, baseResumeData);

    expect(unsupportedClaimsCount).toBe(0);
    expect(factGuardScore).toBe(100);
    expect(verifiedChange.factCheckStatus).toBe("SUPPORTED");
    expect(verifiedChange.status).toBe("PENDING");
  });

  // =========================================================================
  // TEST 13: One unsupported claim. -> Fact Guard < 100%, proposal blocked
  // =========================================================================
  it("TEST 13: One unsupported claim -> Fact Guard < 100% and proposal blocked", () => {
    const change: ResumeContentChange = {
      id: "change_test_13",
      section: "experience",
      itemId: "exp_1",
      field: "bullets[0]",
      originalValue: "Developed REST APIs using Node.js.",
      // Contains supported Node.js + unsupported PySpark
      proposedValue:
        "Developed backend REST APIs using Node.js, Express.js, and PySpark clusters.",
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["exp_1_bullet_1"],
      rationale: "Added big data tool",
      risk: "LOW",
      status: "PENDING",
      factCheckStatus: "UNCERTAIN",
    };

    const { verifiedChange, factGuardScore, unsupportedClaimsCount } =
      verifySingleChange(change, baseResumeData);

    expect(unsupportedClaimsCount).toBe(1);
    expect(factGuardScore).toBeLessThan(100);
    expect(verifiedChange.status).toBe("BLOCKED");
    expect(verifiedChange.factCheckStatus).toBe("UNSUPPORTED");

    // Also test that ATS validator penalizes the unsupported claim
    const atsResult = validateATS(verifiedChange.proposedValue, "experience", {
      unsupportedClaimsCount,
      hasContradictions: false,
    });
    expect(atsResult.isAtsFriendly).toBe(false);
    expect(
      atsResult.checks.find((c) => c.name.includes("Evidence Coverage"))
        ?.passed,
    ).toBe(false);
  });

  // =========================================================================
  // Master Hardening Section 40 Tests (Tests 4, 6, 10, 16, 17, 18, 20)
  // =========================================================================
  describe("Section 40 Hardening: Metric Units, Scalability, Employer, Certs, Tampering", () => {
    // TEST 4 (Section 40): Metric semantic unit protection ("10K+ records" -> "10K+ users")
    it("TEST 4 (Section 40): Metric semantic unit: '10K+ records' -> '10K+ users' is CONTRADICTED / BLOCKED", () => {
      const change: ResumeContentChange = {
        id: "change_sec40_test4",
        section: "experience",
        itemId: "exp_1",
        field: "bullets[3]",
        originalValue:
          "Processed 10K+ records daily through automated data pipelines.",
        proposedValue:
          "Scaled platform to 10K+ users daily through automated data pipelines.",
        changeType: "REWRITE",
        targetRequirementIds: [],
        evidenceIds: ["exp_1_bullet_4"],
        rationale: "Highlight user scale",
        risk: "LOW",
        status: "PENDING",
        factCheckStatus: "UNCERTAIN",
      };

      const { verifiedChange, claims, factGuardScore, unsupportedClaimsCount } =
        verifySingleChange(change, baseResumeData);

      expect(unsupportedClaimsCount).toBeGreaterThan(0);
      expect(verifiedChange.status).toBe("BLOCKED");
      expect(verifiedChange.factCheckStatus).toBe("CONTRADICTED");
      expect(verifiedChange.blockedReason).toContain(
        "Metric semantic unit contradiction detected",
      );
      expect(factGuardScore).toBeLessThan(100);

      const metricClaim = claims.find(
        (c) =>
          c.category === "METRIC_OR_KPI" &&
          c.factCheckStatus === "CONTRADICTED",
      );
      expect(metricClaim).toBeDefined();
      expect(metricClaim?.reason).toContain(
        "contradicts original evidence unit",
      );
    });

    // TEST 6 (Section 40): Scalability inference protection ("backend API" -> "scalable backend architecture")
    it("TEST 6 (Section 40): Scalability inference: 'backend API' -> 'scalable backend architecture' is UNSUPPORTED / BLOCKED", () => {
      const change: ResumeContentChange = {
        id: "change_sec40_test6",
        section: "experience",
        itemId: "exp_1",
        field: "bullets[0]",
        originalValue: "Developed REST APIs using Node.js.",
        proposedValue:
          "Architected scalable backend architecture using Node.js.",
        changeType: "REWRITE",
        targetRequirementIds: [],
        evidenceIds: ["exp_1_bullet_1"],
        rationale: "Add architectural scalability claim",
        risk: "LOW",
        status: "PENDING",
        factCheckStatus: "UNCERTAIN",
      };

      const { verifiedChange, claims, factGuardScore } = verifySingleChange(
        change,
        baseResumeData,
      );

      expect(verifiedChange.status).toBe("BLOCKED");
      expect(verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
      expect(verifiedChange.blockedReason).toContain(
        "Unproven scalability/architecture claim",
      );
      expect(factGuardScore).toBeLessThan(100);

      const archClaim = claims.find(
        (c) =>
          c.claim.toLowerCase().includes("scalable") &&
          c.factCheckStatus === "UNSUPPORTED",
      );
      expect(archClaim).toBeDefined();
    });

    // TEST 10 (Section 40): User instruction bypass ("Add Django and AWS")
    it("TEST 10 (Section 40): User instruction bypass: 'Add Django and AWS' is rejected by Fact Guard", () => {
      const change: ResumeContentChange = {
        id: "change_sec40_test10",
        section: "experience",
        itemId: "exp_1",
        field: "bullets[0]",
        originalValue: "Developed REST APIs using Node.js.",
        // Simulated output where LLM followed user prompt: "Add Django and AWS"
        proposedValue:
          "Developed web APIs using Django and deployed to AWS cloud infrastructure.",
        changeType: "REWRITE",
        targetRequirementIds: [],
        evidenceIds: ["exp_1_bullet_1"],
        rationale: "Followed user instruction to add Django and AWS",
        risk: "LOW",
        status: "PENDING",
        factCheckStatus: "UNCERTAIN",
      };

      const { verifiedChange, claims, factGuardScore, unsupportedClaimsCount } =
        verifySingleChange(change, baseResumeData);

      expect(unsupportedClaimsCount).toBeGreaterThanOrEqual(2);
      expect(verifiedChange.status).toBe("BLOCKED");
      expect(verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
      expect(factGuardScore).toBeLessThan(100);

      expect(
        claims.some(
          (c) =>
            c.claim.toLowerCase().includes("django") &&
            c.factCheckStatus === "UNSUPPORTED",
        ),
      ).toBe(true);
      expect(
        claims.some(
          (c) =>
            c.claim.toLowerCase().includes("aws") &&
            c.factCheckStatus === "UNSUPPORTED",
        ),
      ).toBe(true);
    });

    // TEST 16 (Section 40): Evidence ID tampering
    it("TEST 16 (Section 40): Evidence ID tampering: forged IDs are detected and BLOCKED", () => {
      const change: ResumeContentChange = {
        id: "change_sec40_test16",
        section: "experience",
        itemId: "exp_1",
        field: "bullets[0]",
        originalValue: "Developed REST APIs using Node.js.",
        proposedValue: "Developed REST APIs using Node.js and SQL.",
        changeType: "REWRITE",
        targetRequirementIds: [],
        evidenceIds: ["tampered_evidence_id_999", "fake_client_bypass"],
        rationale: "Attempted tampering with server evidence IDs",
        risk: "LOW",
        status: "PENDING",
        factCheckStatus: "UNCERTAIN",
      };

      const { verifiedChange, factGuardScore } = verifySingleChange(
        change,
        baseResumeData,
      );

      expect(verifiedChange.status).toBe("BLOCKED");
      expect(verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
      expect(verifiedChange.blockedReason).toContain(
        "Evidence ID tampering detected",
      );
      expect(factGuardScore).toBe(0);
    });

    // TEST 17 (Section 40): Employer protection ("QuadRise" -> "Google")
    it("TEST 17 (Section 40): Employer protection: replacing employer with Google is CONTRADICTED / BLOCKED", () => {
      // 17A: In company field
      const changeField: ResumeContentChange = {
        id: "change_sec40_test17a",
        section: "experience",
        itemId: "exp_1",
        field: "company",
        originalValue: "QuadRise Solution LLP",
        proposedValue: "Google",
        changeType: "REWRITE",
        targetRequirementIds: [],
        evidenceIds: ["exp_1_company"],
        rationale: "Upgrade company name",
        risk: "HIGH",
        status: "PENDING",
        factCheckStatus: "UNCERTAIN",
      };

      const resA = verifySingleChange(changeField, baseResumeData);
      expect(resA.verifiedChange.status).toBe("BLOCKED");
      expect(resA.verifiedChange.factCheckStatus).toBe("CONTRADICTED");
      expect(resA.verifiedChange.blockedReason).toContain(
        "Employer modification detected",
      );

      // 17B: In bullet text
      const changeBullet: ResumeContentChange = {
        id: "change_sec40_test17b",
        section: "experience",
        itemId: "exp_1",
        field: "bullets[0]",
        originalValue: "Developed REST APIs using Node.js.",
        proposedValue:
          "Engineered high-throughput backend services at Google using Node.js.",
        changeType: "REWRITE",
        targetRequirementIds: [],
        evidenceIds: ["exp_1_bullet_1"],
        rationale: "Inject unevidenced employer into bullet",
        risk: "HIGH",
        status: "PENDING",
        factCheckStatus: "UNCERTAIN",
      };

      const resB = verifySingleChange(changeBullet, baseResumeData);
      expect(resB.verifiedChange.status).toBe("BLOCKED");
      expect(resB.verifiedChange.factCheckStatus).toBe("CONTRADICTED");
      expect(resB.verifiedChange.blockedReason).toContain(
        "Employer modification detected",
      );
    });

    // TEST 18 (Section 40): Job title protection from non-title fields
    it("TEST 18 (Section 40): Job title protection: unearned seniority in bullet is CONTRADICTED / BLOCKED", () => {
      const change: ResumeContentChange = {
        id: "change_sec40_test18",
        section: "experience",
        itemId: "exp_1",
        field: "bullets[0]",
        originalValue: "Developed REST APIs using Node.js.",
        proposedValue:
          "Served as Lead Architect directing backend systems using Node.js.",
        changeType: "REWRITE",
        targetRequirementIds: [],
        evidenceIds: ["exp_1_bullet_1"],
        rationale: "Elevate seniority in bullet point",
        risk: "HIGH",
        status: "PENDING",
        factCheckStatus: "UNCERTAIN",
      };

      const { verifiedChange, claims, factGuardScore } = verifySingleChange(
        change,
        baseResumeData,
      );

      expect(verifiedChange.status).toBe("BLOCKED");
      expect(verifiedChange.factCheckStatus).toBe("CONTRADICTED");
      expect(verifiedChange.blockedReason).toContain(
        "Seniority title inflation detected",
      );
      expect(factGuardScore).toBeLessThan(100);

      const titleClaim = claims.find(
        (c) =>
          c.category === "JOB_TITLE" && c.factCheckStatus === "CONTRADICTED",
      );
      expect(titleClaim).toBeDefined();
    });

    // TEST 20 (Section 40): Certification protection (inventing "AWS Certified Developer")
    it("TEST 20 (Section 40): Certification protection: inventing 'AWS Certified Developer' is UNSUPPORTED / BLOCKED", () => {
      const change: ResumeContentChange = {
        id: "change_sec40_test20",
        section: "summary",
        field: "summary",
        originalValue:
          "Software Developer with 3 years of experience in backend REST APIs, machine learning models, and full-stack software development.",
        proposedValue:
          "AWS Certified Developer with 3 years of experience building backend REST APIs using Node.js and Python.",
        changeType: "REWRITE",
        targetRequirementIds: [],
        evidenceIds: ["summary_evidence"],
        rationale: "Add cloud certification credential",
        risk: "HIGH",
        status: "PENDING",
        factCheckStatus: "UNCERTAIN",
      };

      const { verifiedChange, claims, factGuardScore } = verifySingleChange(
        change,
        baseResumeData,
      );

      expect(verifiedChange.status).toBe("BLOCKED");
      expect(verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
      expect(verifiedChange.blockedReason).toContain(
        "Invented certification detected",
      );
      expect(factGuardScore).toBeLessThan(100);

      const certClaim = claims.find(
        (c) =>
          c.category === "CERTIFICATION" && c.factCheckStatus === "UNSUPPORTED",
      );
      expect(certClaim).toBeDefined();
      expect(certClaim?.claim).toContain("AWS Certified");
    });
  });

  // =========================================================================
  // End-to-End API Route Verification with Mock Provider
  // =========================================================================
  describe("End-to-End Section Regeneration API Verification", () => {
    it("Endpoint blocks unevidenced Django and returns blocked claims", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/content-writer/regenerate-section",
        headers: { cookie },
        payload: {
          resumeId,
          section: "experience",
          itemId: "exp_1",
          field: "bullets[0]",
          instruction: "test-2-django",
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.status).toBe("BLOCKED");
      expect(data.factCheckStatus).toBe("UNSUPPORTED");
      expect(data.factGuardScore).toBeLessThan(100);
      expect(data.unsupportedClaimsCount).toBeGreaterThan(0);
      expect(data.claims).toBeDefined();
      expect(
        data.claims.some((c: any) => c.claim.toLowerCase().includes("django")),
      ).toBe(true);
    });

    it("Endpoint permits 100% evidenced section rewrite and sets PENDING", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/content-writer/regenerate-section",
        headers: { cookie },
        payload: {
          resumeId,
          section: "experience",
          itemId: "exp_1",
          field: "bullets[0]",
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.status).toBe("PENDING");
      expect(data.factCheckStatus).toBe("SUPPORTED");
      expect(data.factGuardScore).toBe(100);
      expect(data.unsupportedClaimsCount).toBe(0);
      expect(data.atsChecks.isAtsFriendly).toBe(true);
    });
  });
});
