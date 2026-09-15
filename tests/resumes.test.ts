import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { createDefaultResumeData } from "@resumeai/shared";

describe("Resume Endpoints (Phase 2)", () => {
  let app: FastifyInstance;
  const userAEmail = `user.a.resume.${Date.now()}@example.com`;
  const userBEmail = `user.b.resume.${Date.now()}@example.com`;
  const testPassword = "Password123!";

  let cookieA: string;
  let cookieB: string;
  let createdResumeId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Register User A
    const regA = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: userAEmail,
        password: testPassword,
        name: "User A",
      },
    });
    const cookiesA = regA.headers["set-cookie"];
    cookieA = (
      Array.isArray(cookiesA) ? cookiesA[0] : (cookiesA as string)
    ).split(";")[0];

    // Register User B
    const regB = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: userBEmail,
        password: testPassword,
        name: "User B",
      },
    });
    const cookiesB = regB.headers["set-cookie"];
    cookieB = (
      Array.isArray(cookiesB) ? cookiesB[0] : (cookiesB as string)
    ).split(";")[0];
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Authentication Guard", () => {
    it("should reject unauthenticated requests to /api/resumes with 401", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/resumes",
      });
      expect(res.statusCode).toBe(401);
    });

    it("should reject unauthenticated POST /api/resumes with 401", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/resumes",
        payload: { title: "Unauth Resume" },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /api/resumes (Create)", () => {
    it("should reject resume creation with empty title", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/resumes",
        headers: { cookie: cookieA },
        payload: { title: "" },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should create a resume with default resumeData and initial version", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/resumes",
        headers: { cookie: cookieA },
        payload: {
          title: "Full Stack Engineer Resume",
          targetRole: "Senior Full Stack Engineer",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("id");
      expect(body.data.title).toBe("Full Stack Engineer Resume");
      expect(body.data.targetRole).toBe("Senior Full Stack Engineer");
      expect(body.data.resumeData).toBeDefined();
      expect(body.data.resumeData.personalInfo).toBeDefined();
      expect(body.data.resumeData.sectionOrder).toBeDefined();

      createdResumeId = body.data.id;
    });
  });

  describe("GET /api/resumes (List)", () => {
    it("should return the list of resumes for User A", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/resumes",
        headers: { cookie: cookieA },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.items).toBeInstanceOf(Array);
      expect(body.data.total).toBeGreaterThanOrEqual(1);
      expect(body.data.items.some((r: any) => r.id === createdResumeId)).toBe(
        true,
      );
    });

    it("should return empty list for User B (data isolation)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/resumes",
        headers: { cookie: cookieB },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.items).toEqual([]);
      expect(body.data.total).toBe(0);
    });
  });

  describe("GET /api/resumes/:id (Get By ID)", () => {
    it("should retrieve the resume for the owner", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/resumes/${createdResumeId}`,
        headers: { cookie: cookieA },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdResumeId);
      expect(body.data.title).toBe("Full Stack Engineer Resume");
    });

    it("should return 404 when User B tries to access User A's resume", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/resumes/${createdResumeId}`,
        headers: { cookie: cookieB },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PATCH /api/resumes/:id (Autosave & Updates)", () => {
    it("should update resume fields without creating a version row when createVersion is not set", async () => {
      const updatedData = createDefaultResumeData("Alex Morgan");
      updatedData.summary =
        "Experienced software engineer specializing in scalable systems.";

      const res = await app.inject({
        method: "PATCH",
        url: `/api/resumes/${createdResumeId}`,
        headers: { cookie: cookieA },
        payload: {
          title: "Alex Morgan - Senior Resume",
          targetRole: "Lead Architect",
          resumeData: updatedData,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe("Alex Morgan - Senior Resume");
      expect(body.data.targetRole).toBe("Lead Architect");
      expect(body.data.resumeData.summary).toBe(
        "Experienced software engineer specializing in scalable systems.",
      );

      // Verify versions count - should still only have the initial version 1
      const vRes = await app.inject({
        method: "GET",
        url: `/api/resumes/${createdResumeId}/versions`,
        headers: { cookie: cookieA },
      });
      const vBody = JSON.parse(vRes.payload);
      expect(vBody.data.length).toBe(1);
    });

    it("should create a new version when createVersion is true", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/resumes/${createdResumeId}`,
        headers: { cookie: cookieA },
        payload: {
          createVersion: true,
          changeSummary: "Manual milestone save",
        },
      });

      expect(res.statusCode).toBe(200);

      // Check version list now
      const vRes = await app.inject({
        method: "GET",
        url: `/api/resumes/${createdResumeId}/versions`,
        headers: { cookie: cookieA },
      });
      const vBody = JSON.parse(vRes.payload);
      expect(vBody.data.length).toBe(2);
      expect(vBody.data[0].versionNumber).toBe(2);
      expect(vBody.data[0].changeSummary).toBe("Manual milestone save");
    });

    it("should prevent User B from updating User A's resume", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/resumes/${createdResumeId}`,
        headers: { cookie: cookieB },
        payload: { title: "Hacked Resume" },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /api/resumes/:id/duplicate", () => {
    let duplicatedResumeId: string;

    it("should duplicate User A's resume with a copy title and version 1", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/resumes/${createdResumeId}/duplicate`,
        headers: { cookie: cookieA },
        payload: { title: "Cloned Resume For Fintech" },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).not.toBe(createdResumeId);
      expect(body.data.title).toBe("Cloned Resume For Fintech");
      expect(body.data.targetRole).toBe("Lead Architect");
      expect(body.data.resumeData.summary).toBe(
        "Experienced software engineer specializing in scalable systems.",
      );

      duplicatedResumeId = body.data.id;

      // Duplicate should have its own version 1
      const vRes = await app.inject({
        method: "GET",
        url: `/api/resumes/${duplicatedResumeId}/versions`,
        headers: { cookie: cookieA },
      });
      const vBody = JSON.parse(vRes.payload);
      expect(vBody.data.length).toBe(1);
      expect(vBody.data[0].versionNumber).toBe(1);
    });

    it("should prevent User B from duplicating User A's resume", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/resumes/${createdResumeId}/duplicate`,
        headers: { cookie: cookieB },
        payload: {},
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /api/resumes/:id/versions (Explicit Checkpoint)", () => {
    it("should create a checkpoint version snapshot", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/resumes/${createdResumeId}/versions`,
        headers: { cookie: cookieA },
        payload: { changeSummary: "Pre-interview review checkpoint" },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.versionNumber).toBe(3);
      expect(body.data.changeSummary).toBe("Pre-interview review checkpoint");
    });

    it("should fetch specific version by version number", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/resumes/${createdResumeId}/versions/1`,
        headers: { cookie: cookieA },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.versionNumber).toBe(1);
    });

    it("should prevent User B from listing versions of User A's resume (404 Not Found)", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/resumes/${createdResumeId}/versions`,
        headers: { cookie: cookieB },
      });

      expect(res.statusCode).toBe(404);
    });

    it("should prevent User B from creating a version checkpoint on User A's resume (404 Not Found)", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/resumes/${createdResumeId}/versions`,
        headers: { cookie: cookieB },
        payload: { changeSummary: "Malicious checkpoint" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("should prevent User B from fetching a specific version of User A's resume (404 Not Found)", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/resumes/${createdResumeId}/versions/1`,
        headers: { cookie: cookieB },
      });

      expect(res.statusCode).toBe(404);
    });

    it("should reject malicious payloads containing javascript: URLs with 400 VALIDATION_ERROR", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/resumes/${createdResumeId}`,
        headers: { cookie: cookieA },
        payload: {
          resumeData: {
            ...createDefaultResumeData(),
            personalInfo: {
              fullName: "Hacker",
              website: "javascript:alert(1)",
            },
          },
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Resume Design & Template Endpoints (Phase 3)", () => {
    let designResumeId: string;

    beforeAll(async () => {
      // Create a dedicated resume for design tests
      const res = await app.inject({
        method: "POST",
        url: "/api/resumes",
        headers: { cookie: cookieA },
        payload: {
          title: "Template Test Resume",
          templateId: "modern",
          initialData: {
            ...createDefaultResumeData("Alex Design"),
            summary: "Experienced designer and engineer.",
          },
          templateConfig: {
            templateId: "modern",
            fontFamily: "Inter",
            fontSize: "md",
            accentColor: "blue",
            spacing: "comfortable",
            margins: "normal",
            pageSize: "a4",
          },
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      designResumeId = body.data.id;
      expect(body.data.currentTemplateId).toBe("modern");
      expect(body.data.templateConfig).toBeDefined();
      expect(body.data.templateConfig.accentColor).toBe("blue");
    });

    it("should update template design via PATCH /api/resumes/:id/design", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/resumes/${designResumeId}/design`,
        headers: { cookie: cookieA },
        payload: {
          templateId: "classic",
          templateConfig: {
            templateId: "classic",
            fontFamily: "Georgia",
            fontSize: "lg",
            accentColor: "burgundy",
            spacing: "spacious",
            margins: "relaxed",
            pageSize: "letter",
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.currentTemplateId).toBe("classic");
      expect(body.data.templateConfig.fontFamily).toBe("Georgia");
      expect(body.data.templateConfig.fontSize).toBe("lg");
      expect(body.data.templateConfig.accentColor).toBe("burgundy");
      expect(body.data.templateConfig.pageSize).toBe("letter");

      // Verify resume data content was NOT modified
      expect(body.data.resumeData.personalInfo.fullName).toBe("Alex Design");
      expect(body.data.resumeData.summary).toBe(
        "Experienced designer and engineer.",
      );
    });

    it("should allow partial design update via PATCH /api/resumes/:id/design", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/resumes/${designResumeId}/design`,
        headers: { cookie: cookieA },
        payload: {
          templateId: "executive",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.currentTemplateId).toBe("executive");
    });

    it("should prevent User B from updating User A's design", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/resumes/${designResumeId}/design`,
        headers: { cookie: cookieB },
        payload: {
          templateId: "minimal",
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it("should reject invalid templateId with 400 VALIDATION_ERROR", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/resumes/${designResumeId}/design`,
        headers: { cookie: cookieA },
        payload: {
          templateId: "non-existent-template",
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject invalid font family or color with 400 VALIDATION_ERROR", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/resumes/${designResumeId}/design`,
        headers: { cookie: cookieA },
        payload: {
          templateConfig: {
            fontFamily: "Comic Sans",
          },
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should preserve templateConfig and templateId when duplicating a resume", async () => {
      const dupRes = await app.inject({
        method: "POST",
        url: `/api/resumes/${designResumeId}/duplicate`,
        headers: { cookie: cookieA },
        payload: { title: "Duplicated Design Resume" },
      });

      expect(dupRes.statusCode).toBe(201);
      const body = JSON.parse(dupRes.payload);
      expect(body.data.currentTemplateId).toBe("executive");
      expect(body.data.templateConfig).toBeDefined();
      expect(body.data.templateConfig.fontFamily).toBe("Georgia");

      // Verify the duplicated initial version also has templateConfig
      const versionsRes = await app.inject({
        method: "GET",
        url: `/api/resumes/${body.data.id}/versions`,
        headers: { cookie: cookieA },
      });
      const versionsBody = JSON.parse(versionsRes.payload);
      expect(versionsBody.data.length).toBe(1);
      expect(versionsBody.data[0].templateConfig).toBeDefined();
      expect(versionsBody.data[0].templateConfig.fontFamily).toBe("Georgia");
    });
  });

  describe("DELETE /api/resumes/:id", () => {
    it("should prevent User B from deleting User A's resume", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/resumes/${createdResumeId}`,
        headers: { cookie: cookieB },
      });

      expect(res.statusCode).toBe(404);
    });

    it("should delete User A's resume", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/resumes/${createdResumeId}`,
        headers: { cookie: cookieA },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);

      // Verify resume is deleted
      const checkRes = await app.inject({
        method: "GET",
        url: `/api/resumes/${createdResumeId}`,
        headers: { cookie: cookieA },
      });
      expect(checkRes.statusCode).toBe(404);
    });
  });
});
