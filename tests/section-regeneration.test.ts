import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { prisma } from "@resumeai/database";
import { ResumeData, ResumeDataSchema, JobAnalysis } from "@resumeai/shared";
import { validateATS } from "../src/ai/ats-validator/ats-validator.js";

describe("AI Section Regeneration & ATS Validation", () => {
  let app: FastifyInstance;
  const timestamp = Date.now();
  const userAEmail = `sec.writer.a.${timestamp}@example.com`;
  const userBEmail = `sec.writer.b.${timestamp}@example.com`;
  const testPassword = "Password123!";

  let cookieA: string;
  let cookieB: string;
  let resumeAId: string;
  let jobAId: string;
  let userAId: string;
  let userBId: string;

  const mockResumeData: ResumeData = ResumeDataSchema.parse({
    personalInfo: {
      fullName: "Yash Sharma",
      headline: "Software Developer",
      email: "yash@example.com",
      phone: "+91 9876543210",
      location: "India",
    },
    summary:
      "Software Developer experienced in web development and machine learning.",
    experience: [
      {
        id: "exp_1",
        jobTitle: "Software Developer",
        position: "Software Developer",
        company: "QuadRise Solution LLP",
        location: "Remote",
        startDate: "Sep 2025",
        endDate: "Present",
        current: true,
        bullets: [
          "Developed REST APIs using Node.js.",
          "Machine learning model achieved 92% accuracy.",
        ],
        technologiesUsed: [
          "Node.js",
          "Express.js",
          "Python",
          "SQL",
          "Scikit-learn",
        ],
      },
    ],
    education: [
      {
        id: "edu_1",
        institution: "University of Tech",
        degree: "B.Tech",
        fieldOfStudy: "Computer Science",
        startDate: "2021",
        endDate: "2025",
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

  const mockJobAnalysis: JobAnalysis = {
    jobTitle: "Data Scientist",
    company: "AI Innovations Inc",
    seniority: "MID_LEVEL",
    summary:
      "Seeking a Data Scientist experienced in Python, Machine Learning, and Recommendation Systems.",
    skills: [
      {
        name: "Python",
        normalizedName: "python",
        category: "REQUIRED_SKILL",
        importance: "REQUIRED",
        explicit: true,
        evidence: "Python proficiency required",
        confidence: 1.0,
      },
      {
        name: "Machine Learning",
        normalizedName: "machine learning",
        category: "REQUIRED_SKILL",
        importance: "REQUIRED",
        explicit: true,
        evidence: "Machine learning model development",
        confidence: 1.0,
      },
      {
        name: "Databricks",
        normalizedName: "databricks",
        category: "REQUIRED_SKILL",
        importance: "REQUIRED",
        explicit: true,
        evidence: "Big data pipelines in Databricks",
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
    roleSummary:
      "Data Scientist role focusing on machine learning and recommendation engines.",
    requiredSkills: ["Python", "Machine Learning", "Databricks"],
    preferredSkills: ["PySpark", "AWS"],
    experienceYearsMinimum: 3,
  };

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Register User A
    const regResA = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: userAEmail,
        password: testPassword,
        name: "Candidate Yash",
      },
    });
    cookieA = regResA.headers["set-cookie"] as string;
    userAId = JSON.parse(regResA.payload).data.user.id;

    // Register User B
    const regResB = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: userBEmail,
        password: testPassword,
        name: "Candidate Bob",
      },
    });
    cookieB = regResB.headers["set-cookie"] as string;
    userBId = JSON.parse(regResB.payload).data.user.id;

    // Create Resume for User A
    const resume = await prisma.resume.create({
      data: {
        userId: userAId,
        title: "Yash Sharma Resume",
        resumeData: mockResumeData as any,
      },
    });
    resumeAId = resume.id;

    // Create Target Job for User A
    const job = await prisma.jobDescription.create({
      data: {
        userId: userAId,
        title: "Data Scientist",
        company: "AI Innovations Inc",
        rawText:
          "Seeking a Data Scientist experienced in Python, Machine Learning, and Recommendation Systems.",
        status: "COMPLETED",
        parsedData: mockJobAnalysis as any,
      },
    });
    jobAId = job.id;
  });

  afterAll(async () => {
    if (resumeAId) {
      await prisma.contentProposal.deleteMany({
        where: { resumeId: resumeAId },
      });
      await prisma.resumeVersion.deleteMany({ where: { resumeId: resumeAId } });
      await prisma.resume.delete({ where: { id: resumeAId } }).catch(() => {});
    }
    if (jobAId) {
      await prisma.jobDescription
        .delete({ where: { id: jobAId } })
        .catch(() => {});
    }
    if (userAId || userBId) {
      await prisma.user
        .deleteMany({
          where: { id: { in: [userAId, userBId] } },
        })
        .catch(() => {});
    }
    await app.close();
  });

  describe("ATS Validator Unit Checks", () => {
    it("flags decorative emojis and symbols as non-ATS friendly", () => {
      const result = validateATS(
        "🚀 Spearheaded incredible cloud migration!!!",
        "experience",
      );
      expect(result.isAtsFriendly).toBe(false);
      const emojiCheck = result.checks.find((c) => c.name.includes("Emojis"));
      expect(emojiCheck?.passed).toBe(false);
    });

    it("flags excessive punctuation", () => {
      const result = validateATS(
        "Developed backend APIs with Node.js???",
        "experience",
      );
      const punctCheck = result.checks.find((c) =>
        c.name.includes("Punctuation"),
      );
      expect(punctCheck?.passed).toBe(false);
    });

    it("flags keyword stuffing", () => {
      const stuffed =
        "Python Python Python developer writing Python Python code in Python backend systems.";
      const result = validateATS(stuffed, "skills");
      const densityCheck = result.checks.find((c) =>
        c.name.includes("Keyword Density"),
      );
      expect(densityCheck?.passed).toBe(false);
    });

    it("passes professional ATS-friendly summary", () => {
      const cleanSummary =
        "Software Developer with 4 years of experience building scalable backend APIs and machine learning pipelines. Proficient in Node.js, Python, and SQL with a proven track record in microservices and predictive modeling. Experienced in collaborating across cross-functional engineering teams.";
      const result = validateATS(cleanSummary, "summary");
      expect(result.isAtsFriendly).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(75);
    });

    it("passes concise experience bullet starting with strong action verb", () => {
      const cleanBullet =
        "Developed backend REST APIs using Node.js and Express.js to support mission-critical customer workflows.";
      const result = validateATS(cleanBullet, "experience");
      expect(result.isAtsFriendly).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(75);
    });
  });

  describe("Section Regeneration API Endpoints", () => {
    it("Mode 1: regenerates summary with general ATS improvement", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/content-writer/regenerate-section",
        headers: { cookie: cookieA },
        payload: {
          resumeId: resumeAId,
          section: "summary",
          field: "summary",
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.proposalId).toBeDefined();
      expect(data.changeId).toBeDefined();
      expect(data.originalValue).toBe(mockResumeData.summary);
      expect(data.proposedValue).toContain("Software Developer");
      expect(data.status).toBe("PENDING");
      expect(data.factCheckStatus).toBe("SUPPORTED");
      expect(data.atsChecks.isAtsFriendly).toBe(true);
    });

    it("Mode 2: regenerates experience bullet tailored to target job", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/content-writer/regenerate-section",
        headers: { cookie: cookieA },
        payload: {
          resumeId: resumeAId,
          section: "experience",
          itemId: "exp_1",
          field: "bullets[0]",
          targetJobId: jobAId,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.originalValue).toBe("Developed REST APIs using Node.js.");
      expect(data.proposedValue).toContain("Express.js");
      expect(data.status).toBe("PENDING");
      expect(data.factCheckStatus).toBe("SUPPORTED");
    });

    it("regenerates project description incorporating candidate project evidence", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/content-writer/regenerate-section",
        headers: { cookie: cookieA },
        payload: {
          resumeId: resumeAId,
          section: "projects",
          itemId: "proj_1",
          field: "description",
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.proposedValue).toContain("CountVectorizer");
      expect(data.status).toBe("PENDING");
      expect(data.factCheckStatus).toBe("SUPPORTED");
    });

    it("blocks unsupported technology addition via Fact Guard (PySpark/Databricks)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/content-writer/regenerate-section",
        headers: { cookie: cookieA },
        payload: {
          resumeId: resumeAId,
          section: "experience",
          itemId: "exp_1",
          field: "bullets[0]",
          instruction: "try unsupported-tech addition",
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.status).toBe("BLOCKED");
      expect(data.factCheckStatus).toBe("UNSUPPORTED");
      expect(data.blockedReason).toContain("Unsupported technology detected");
    });

    it("blocks metric inflation via Fact Guard", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/content-writer/regenerate-section",
        headers: { cookie: cookieA },
        payload: {
          resumeId: resumeAId,
          section: "experience",
          itemId: "exp_1",
          field: "bullets[1]",
          instruction: "try invented-metric 99%",
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.status).toBe("BLOCKED");
      expect(data.factCheckStatus).toBe("CONTRADICTED");
      expect(data.blockedReason).toContain("Metric inflation detected");
    });

    it("User B cannot regenerate sections of User A's resume (Ownership 404)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/content-writer/regenerate-section",
        headers: { cookie: cookieB },
        payload: {
          resumeId: resumeAId,
          section: "summary",
          field: "summary",
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it("Applies accepted section proposal atomically and creates ResumeVersion snapshot", async () => {
      // 1. Generate safe summary proposal
      const genRes = await app.inject({
        method: "POST",
        url: "/api/content-writer/regenerate-section",
        headers: { cookie: cookieA },
        payload: {
          resumeId: resumeAId,
          section: "summary",
          field: "summary",
        },
      });
      const genData = JSON.parse(genRes.payload).data;
      const proposalId = genData.proposalId;
      const changeId = genData.changeId;

      const versionsBefore = await prisma.resumeVersion.count({
        where: { resumeId: resumeAId },
      });

      // 2. Apply change via existing apply endpoint
      const applyRes = await app.inject({
        method: "POST",
        url: `/api/content-writer/proposals/${proposalId}/apply`,
        headers: { cookie: cookieA },
        payload: {
          selectedChangeIds: [changeId],
        },
      });

      expect(applyRes.statusCode).toBe(200);
      const applyData = JSON.parse(applyRes.payload).data;
      expect(applyData.success).toBe(true);

      // Verify ResumeVersion snapshot created
      const versionsAfter = await prisma.resumeVersion.count({
        where: { resumeId: resumeAId },
      });
      expect(versionsAfter).toBe(versionsBefore + 1);

      // Verify updated Resume
      const updatedResume = await prisma.resume.findUnique({
        where: { id: resumeAId },
      });
      expect((updatedResume?.resumeData as any).summary).toBe(
        genData.proposedValue,
      );
    });
  });
});
