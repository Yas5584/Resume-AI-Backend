import { describe, it, expect } from "vitest";
import {
  ResumeDataSchema,
  createDefaultResumeData,
  PersonalInfoSchema,
  WorkExperienceSchema,
  EducationSchema,
  ProjectSchema,
  SkillCategorySchema,
  CertificationSchema,
  AchievementSchema,
  LanguageSchema,
  CustomLinkSchema,
} from "../src/schemas/resume.schema.js";

describe("Resume Domain Schemas (Phase 2)", () => {
  describe("createDefaultResumeData", () => {
    it("should generate a valid default resume data object", () => {
      const defaultData = createDefaultResumeData("Alex Morgan");
      const parsed = ResumeDataSchema.parse(defaultData);

      expect(parsed.personalInfo.fullName).toBe("Alex Morgan");
      expect(parsed.summary).toBe("");
      expect(parsed.experience).toEqual([]);
      expect(parsed.education).toEqual([]);
      expect(parsed.projects).toEqual([]);
      expect(parsed.skills).toEqual([]);
      expect(parsed.certifications).toEqual([]);
      expect(parsed.achievements).toEqual([]);
      expect(parsed.languages).toEqual([]);
      expect(parsed.links).toEqual([]);
      expect(parsed.sectionVisibility.showSummary).toBe(true);
      expect(parsed.sectionOrder.length).toBe(9);
    });
  });

  describe("Section Schema Validations", () => {
    it("should validate PersonalInfo with optional fields and reject invalid email", () => {
      const valid = PersonalInfoSchema.parse({
        fullName: "Jane Doe",
        headline: "Principal Engineer",
        email: "jane@example.com",
        phone: "+1 555-0199",
        website: "https://janedoe.com",
      });
      expect(valid.fullName).toBe("Jane Doe");

      expect(() =>
        PersonalInfoSchema.parse({
          fullName: "Jane Doe",
          email: "not-an-email",
        }),
      ).toThrow();
    });

    it("should validate WorkExperience and require company, position/jobTitle", () => {
      const valid = WorkExperienceSchema.parse({
        jobTitle: "Senior Developer",
        company: "Acme Corp",
        startDate: "2022-01",
        endDate: "2024-05",
        current: false,
        bullets: ["Engineered scalable APIs", "Mentored junior engineers"],
      });
      expect(valid.jobTitle).toBe("Senior Developer");
      expect(valid.bullets.length).toBe(2);
      expect(valid.id).toBeDefined();

      expect(() =>
        WorkExperienceSchema.parse({
          jobTitle: "",
          company: "Acme",
        }),
      ).toThrow();
    });

    it("should validate Education entries", () => {
      const valid = EducationSchema.parse({
        institution: "Stanford University",
        degree: "B.S. in Computer Science",
        startDate: "2018",
        endDate: "2022",
      });
      expect(valid.institution).toBe("Stanford University");
    });

    it("should validate Projects and ensure technologies array is supported", () => {
      const valid = ProjectSchema.parse({
        name: "ResumeAI SaaS",
        description: "AI-powered resume platform",
        technologies: ["React", "Fastify", "PostgreSQL"],
        bullets: ["Built with Next.js 15"],
      });
      expect(valid.name).toBe("ResumeAI SaaS");
      expect(valid.technologies).toContain("PostgreSQL");
    });

    it("should validate SkillCategory with categorized skill lists", () => {
      const valid = SkillCategorySchema.parse({
        category: "Programming Languages",
        skills: ["TypeScript", "Python", "Rust", "Go"],
      });
      expect(valid.category).toBe("Programming Languages");
      expect(valid.skills.length).toBe(4);
    });

    it("should validate Languages with controlled proficiency levels", () => {
      const valid = LanguageSchema.parse({
        language: "French",
        proficiency: "Fluent",
      });
      expect(valid.language).toBe("French");
      expect(valid.proficiency).toBe("Fluent");

      expect(() =>
        LanguageSchema.parse({
          language: "Spanish",
          proficiency: "InvalidLevel" as any,
        }),
      ).toThrow();
    });

    it("should validate full ResumeData with all 10 sections populated", () => {
      const fullResumeData = {
        personalInfo: {
          fullName: "John Smith",
          headline: "Staff Software Engineer",
          email: "john@smith.io",
          phone: "555-123-4567",
          location: "San Francisco, CA",
          website: "https://johnsmith.io",
          linkedin: "https://linkedin.com/in/johnsmith",
          github: "https://github.com/johnsmith",
        },
        summary:
          "Seasoned engineer with 10+ years architecting cloud platforms.",
        experience: [
          {
            id: "exp-1",
            jobTitle: "Lead Architect",
            company: "TechNova",
            startDate: "2020-01",
            endDate: "Present",
            current: true,
            bullets: ["Led microservices migration"],
          },
        ],
        education: [
          {
            id: "edu-1",
            institution: "MIT",
            degree: "M.S. Computer Science",
          },
        ],
        projects: [
          {
            id: "proj-1",
            name: "CloudOrchestrator",
            description: "Distributed workflow scheduler",
            technologies: ["TypeScript", "Docker"],
            bullets: ["Zero-downtime rolling deploys"],
          },
        ],
        skills: [
          {
            id: "skill-1",
            category: "Cloud",
            skills: ["AWS", "GCP", "Kubernetes"],
          },
        ],
        certifications: [
          {
            id: "cert-1",
            name: "AWS Certified Solutions Architect",
            issuer: "Amazon Web Services",
          },
        ],
        achievements: [
          {
            id: "ach-1",
            title: "Published Open Source Tool (10k+ stars)",
            description: "Creator and lead maintainer",
          },
        ],
        languages: [
          {
            id: "lang-1",
            language: "English",
            proficiency: "Native" as const,
          },
        ],
        links: [
          {
            id: "link-1",
            label: "Portfolio",
            url: "https://johnsmith.io",
          },
        ],
        sectionVisibility: {
          showSummary: true,
          showExperience: true,
          showEducation: true,
          showProjects: true,
          showSkills: true,
          showCertifications: true,
          showAchievements: true,
          showLanguages: true,
          showLinks: true,
        },
        sectionOrder: [
          "summary",
          "experience",
          "education",
          "projects",
          "skills",
          "certifications",
          "achievements",
          "languages",
          "links",
        ],
      };

      const parsed = ResumeDataSchema.parse(fullResumeData);
      expect(parsed.experience[0].company).toBe("TechNova");
      expect(parsed.certifications[0].name).toBe(
        "AWS Certified Solutions Architect",
      );
    });

    it("should reject dangerous URL schemes (javascript:, data:) in SafeUrlSchema", () => {
      // Personal Info website
      expect(() =>
        PersonalInfoSchema.parse({
          fullName: "Malicious User",
          website: "javascript:alert(document.cookie)",
        }),
      ).toThrow();

      // Project URL
      expect(() =>
        ProjectSchema.parse({
          name: "XSS Exploit",
          url: "javascript:alert(1)",
        }),
      ).toThrow();

      // Custom Link URL
      expect(() =>
        CustomLinkSchema.parse({
          label: "Malicious Link",
          url: "data:text/html,<script>alert(1)</script>",
        }),
      ).toThrow();
    });
  });
});
