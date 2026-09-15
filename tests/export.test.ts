import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { createDefaultResumeData } from "@resumeai/shared";

describe("Resume Export Endpoints (Phase 4)", () => {
  let app: FastifyInstance;
  const userAEmail = `user.a.export.${Date.now()}@example.com`;
  const userBEmail = `user.b.export.${Date.now()}@example.com`;
  const testPassword = "Password123!";

  let cookieA: string;
  let cookieB: string;
  let resumeIdA: string;

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
        name: "User A (Export)",
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
        name: "User B (Export)",
      },
    });
    const cookiesB = regB.headers["set-cookie"];
    cookieB = (
      Array.isArray(cookiesB) ? cookiesB[0] : (cookiesB as string)
    ).split(";")[0];

    // Create a rich resume for User A
    const createRes = await app.inject({
      method: "POST",
      url: "/api/resumes",
      headers: { cookie: cookieA },
      payload: {
        title: "Alex Morgan - Lead Architect",
        templateId: "modern",
        initialData: {
          ...createDefaultResumeData("Alex Morgan"),
          personalInfo: {
            fullName: "Alex Morgan",
            headline: "Staff Cloud Architect",
            email: "alex.morgan@example.com",
            phone: "+1 555-0100",
            location: "San Francisco, CA",
            website: "https://alexmorgan.dev",
            linkedin: "https://linkedin.com/in/alexmorgan",
            github: "https://github.com/alexmorgan",
          },
          summary:
            "Experienced cloud systems architect specialized in distributed microservices.",
          experience: [
            {
              id: "exp-1",
              position: "Staff Architect",
              company: "CloudTech",
              location: "San Francisco, CA",
              employmentType: "Full-time",
              startDate: "2021",
              endDate: "",
              current: true,
              description: "Leading cloud architecture.",
              bullets: [
                "Architected high-throughput services handling 50k req/s.",
                "Reduced infrastructure cost by 25%.",
              ],
              technologiesUsed: ["Node.js", "TypeScript", "PostgreSQL"],
            },
            {
              id: "exp-2",
              position: "Senior Engineer",
              company: "DataScale",
              location: "Palo Alto, CA",
              employmentType: "Full-time",
              startDate: "2018",
              endDate: "2021",
              current: false,
              description: "Engineered distributed streaming pipeline.",
              bullets: ["Scaled Kafka clusters to process 1B events daily."],
              technologiesUsed: ["Go", "Kafka", "Docker"],
            },
          ],
          education: [
            {
              id: "edu-1",
              institution: "UC Berkeley",
              degree: "B.S. in Computer Science",
              fieldOfStudy: "Computer Science",
              location: "Berkeley, CA",
              startDate: "2014",
              endDate: "2018",
              current: false,
              gpa: "3.9",
              description: "",
              honors: ["Summa Cum Laude"],
            },
          ],
          projects: [
            {
              id: "proj-1",
              name: "Resume Engine",
              role: "Lead Architect",
              technologies: ["TypeScript", "Playwright", "Fastify"],
              url: "https://github.com/example/resume-engine",
              repoUrl: "https://github.com/example/resume-engine",
              bullets: ["Engineered PDF and DOCX generation pipeline."],
              highlights: ["Engineered PDF and DOCX generation pipeline."],
            },
          ],
          skills: [
            {
              id: "sk-1",
              category: "Cloud & Distributed Systems",
              skills: ["Kubernetes", "AWS", "Docker", "Terraform"],
            },
          ],
          certifications: [
            {
              id: "cert-1",
              name: "AWS Solutions Architect Professional",
              issuer: "Amazon Web Services",
              issueDate: "2023",
            },
          ],
          achievements: [
            {
              id: "ach-1",
              title: "Conference Keynote Speaker",
              description: "Keynote on microservices architecture.",
              date: "2024",
            },
          ],
          languages: [
            {
              id: "lang-1",
              language: "English",
              proficiency: "Native",
            },
          ],
          links: [
            {
              id: "link-1",
              label: "Engineering Blog",
              url: "https://alexmorgan.dev/blog",
            },
          ],
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

    expect(createRes.statusCode).toBe(201);
    const body = JSON.parse(createRes.payload);
    resumeIdA = body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Authentication & Ownership Guards", () => {
    it("should reject unauthenticated PDF export with 401", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/resumes/${resumeIdA}/export/pdf`,
      });
      expect(res.statusCode).toBe(401);
    });

    it("should reject unauthenticated DOCX export with 401", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/resumes/${resumeIdA}/export/docx`,
      });
      expect(res.statusCode).toBe(401);
    });

    it("should prevent User B from exporting User A's PDF (404 Not Found)", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/resumes/${resumeIdA}/export/pdf`,
        headers: { cookie: cookieB },
      });
      expect(res.statusCode).toBe(404);
    });

    it("should prevent User B from exporting User A's DOCX (404 Not Found)", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/resumes/${resumeIdA}/export/docx`,
        headers: { cookie: cookieB },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("PDF Export (Playwright Engine)", () => {
    it("should export a valid PDF with correct headers and magic bytes", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/resumes/${resumeIdA}/export/pdf`,
        headers: { cookie: cookieA },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["content-disposition"]).toMatch(
        /attachment; filename="Alex-Morgan-Lead-Architect\.pdf"/,
      );

      const rawBuffer = res.rawPayload;
      expect(rawBuffer.length).toBeGreaterThan(1000);

      // Verify PDF magic bytes (%PDF-)
      const magicBytes = rawBuffer.subarray(0, 5).toString("ascii");
      expect(magicBytes).toBe("%PDF-");
    }, 20000);

    it("should export PDF using Classic template and Letter page size", async () => {
      // Switch design to Classic & Letter
      await app.inject({
        method: "PATCH",
        url: `/api/resumes/${resumeIdA}/design`,
        headers: { cookie: cookieA },
        payload: {
          templateId: "classic",
          templateConfig: {
            templateId: "classic",
            fontFamily: "Georgia",
            fontSize: "md",
            accentColor: "slate",
            spacing: "comfortable",
            margins: "normal",
            pageSize: "letter",
          },
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/resumes/${resumeIdA}/export/pdf`,
        headers: { cookie: cookieA },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      const magicBytes = res.rawPayload.subarray(0, 5).toString("ascii");
      expect(magicBytes).toBe("%PDF-");
    }, 20000);
  });

  describe("DOCX Export (Word Engine)", () => {
    it("should export a valid DOCX with correct headers and ZIP magic bytes", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/resumes/${resumeIdA}/export/docx`,
        headers: { cookie: cookieA },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      expect(res.headers["content-disposition"]).toMatch(
        /attachment; filename="Alex-Morgan-Lead-Architect\.docx"/,
      );

      const rawBuffer = res.rawPayload;
      expect(rawBuffer.length).toBeGreaterThan(1000);

      // Verify ZIP/DOCX magic bytes (PK\x03\x04)
      expect(rawBuffer[0]).toBe(0x50); // P
      expect(rawBuffer[1]).toBe(0x4b); // K
      expect(rawBuffer[2]).toBe(0x03);
      expect(rawBuffer[3]).toBe(0x04);
    });
  });

  describe("Content and Version Invariants", () => {
    it("should ensure resumeData and version count remain unchanged after exports", async () => {
      // Fetch initial state
      const beforeRes = await app.inject({
        method: "GET",
        url: `/api/resumes/${resumeIdA}`,
        headers: { cookie: cookieA },
      });
      const beforeBody = JSON.parse(beforeRes.payload);

      const versionsBeforeRes = await app.inject({
        method: "GET",
        url: `/api/resumes/${resumeIdA}/versions`,
        headers: { cookie: cookieA },
      });
      const versionsBefore = JSON.parse(versionsBeforeRes.payload);

      // Perform exports
      await app.inject({
        method: "GET",
        url: `/api/resumes/${resumeIdA}/export/pdf`,
        headers: { cookie: cookieA },
      });

      await app.inject({
        method: "GET",
        url: `/api/resumes/${resumeIdA}/export/docx`,
        headers: { cookie: cookieA },
      });

      // Fetch state after exports
      const afterRes = await app.inject({
        method: "GET",
        url: `/api/resumes/${resumeIdA}`,
        headers: { cookie: cookieA },
      });
      const afterBody = JSON.parse(afterRes.payload);

      const versionsAfterRes = await app.inject({
        method: "GET",
        url: `/api/resumes/${resumeIdA}/versions`,
        headers: { cookie: cookieA },
      });
      const versionsAfter = JSON.parse(versionsAfterRes.payload);

      // Assert data invariant
      expect(afterBody.data.resumeData).toEqual(beforeBody.data.resumeData);
      expect(afterBody.data.currentTemplateId).toBe(
        beforeBody.data.currentTemplateId,
      );

      // Assert version invariant (no version created by exports)
      expect(versionsAfter.data.length).toBe(versionsBefore.data.length);
    }, 20000);
  });
});
