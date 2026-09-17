import { describe, it, expect } from "vitest";
import { ResumeData, FindingSeverity, ResumeQualityCategory } from "@resumeai/shared";
import { checkATSStructure } from "../src/quality/checks/ats-structure.check.js";
import { checkContactAndLinks, isValidUrlSyntax } from "../src/quality/checks/contact-links.check.js";
import { checkExperienceAndContent } from "../src/quality/checks/experience.check.js";
import { checkSkills } from "../src/quality/checks/skills.check.js";
import { checkEducationAndCertifications } from "../src/quality/checks/education.check.js";
import { checkFormattingAndParseability } from "../src/quality/checks/formatting.check.js";
import { checkConsistencyAndDuplication } from "../src/quality/checks/consistency.check.js";
import { runAllDeterministicChecks } from "../src/quality/checks/index.js";

describe("Deterministic Quality Checks (Phase 10 Accuracy)", () => {
  const baseResume: any = {
    personalInfo: {
      fullName: "Jane Doe",
      email: "jane.doe@example.com",
      phone: "+1 (555) 234-5678",
      location: "San Francisco, CA",
      website: "https://janedoe.dev",
      linkedin: "https://linkedin.com/in/janedoe",
      github: "https://github.com/janedoe",
    },
    summary:
      "Senior Full-Stack Engineer with 6+ years of experience architecting high-throughput distributed systems.",
    experience: [
      {
        id: "exp-1",
        position: "Senior Software Engineer",
        jobTitle: "Senior Software Engineer",
        company: "Tech Corp",
        employmentType: "Full-time",
        location: "San Francisco, CA",
        startDate: "2022-01",
        endDate: "Present",
        current: true,
        description: "",
        bullets: [
          "Architected real-time event streaming pipeline processing 25M daily events with Kafka.",
          "Optimized database query performance reducing p99 latency by 45% across services.",
          "Spearheaded migration of legacy monolith to Kubernetes microservices, cutting costs by $120k.",
        ],
        technologiesUsed: ["TypeScript", "Node.js", "Kafka", "PostgreSQL"],
      },
      {
        id: "exp-2",
        position: "Software Engineer",
        jobTitle: "Software Engineer",
        company: "Startup Inc",
        employmentType: "Full-time",
        location: "San Jose, CA",
        startDate: "2019-06",
        endDate: "2021-12",
        current: false,
        description: "",
        bullets: [
          "Developed responsive customer dashboard using React and TypeScript for 50,000 active users.",
          "Implemented automated CI/CD pipeline reducing deployment cycle from 4 hours to 15 minutes.",
        ],
        technologiesUsed: ["React", "TypeScript", "Docker"],
      },
    ],
    education: [
      {
        id: "edu-1",
        institution: "University of California, Berkeley",
        degree: "Bachelor of Science",
        fieldOfStudy: "Computer Science",
        startDate: "2015-08",
        endDate: "2019-05",
        current: false,
      },
    ],
    skills: [
      {
        id: "sk-1",
        category: "Languages",
        skills: ["TypeScript", "JavaScript", "Python", "SQL"],
      },
      {
        id: "sk-2",
        category: "Frameworks & Tools",
        skills: ["React", "Node.js", "Docker", "PostgreSQL", "Kafka"],
      },
    ],
  };

  // =========================================================================
  // 1. URI Schemes & URL Validation (Requirement 2)
  // =========================================================================
  describe("URL & URI Scheme Validation", () => {
    it("validates mailto:, tel:, http, https, and bare domains accurately", () => {
      // Valid URLs
      expect(isValidUrlSyntax("mailto:user@example.com")).toBe(true);
      expect(isValidUrlSyntax("mailto:ys136450@gmail.com")).toBe(true);
      expect(isValidUrlSyntax("tel:+1234567890")).toBe(true);
      expect(isValidUrlSyntax("https://linkedin.com/in/example")).toBe(true);
      expect(isValidUrlSyntax("https://github.com/example")).toBe(true);
      expect(isValidUrlSyntax("http://example.com/portfolio")).toBe(true);
      expect(isValidUrlSyntax("linkedin.com/in/example")).toBe(true);
      expect(isValidUrlSyntax("github.com/example")).toBe(true);

      // Invalid URLs
      expect(isValidUrlSyntax("random-text")).toBe(false);
      expect(isValidUrlSyntax("https://")).toBe(false);
      expect(isValidUrlSyntax("http://")).toBe(false);
      expect(isValidUrlSyntax("mailto:")).toBe(false);
      expect(isValidUrlSyntax("mailto:not-an-email")).toBe(false);
      expect(isValidUrlSyntax("tel:")).toBe(false);
      expect(isValidUrlSyntax("tel:abc")).toBe(false);
      expect(isValidUrlSyntax("")).toBe(false);
    });

    it("does not flag mailto email in custom links as invalid", () => {
      const resumeWithMailtoLink: any = {
        ...baseResume,
        links: [
          {
            id: "link-email",
            label: "Email Me",
            url: "mailto:ys136450@gmail.com",
          },
        ],
      };
      const res = checkContactAndLinks(resumeWithMailtoLink);
      const invalidCustomLink = res.findings.find(
        (f) => f.id === "contact-invalid-custom-link-link-email",
      );
      expect(invalidCustomLink).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. Contact & Links Check & Severity Calibration (Requirements 5 & 7)
  // =========================================================================
  describe("Contact & Links Severity Calibration", () => {
    it("classifies missing phone as MEDIUM severity, not CRITICAL", () => {
      const noPhoneResume: any = {
        ...baseResume,
        personalInfo: {
          ...baseResume.personalInfo!,
          phone: "",
        },
      };
      const res = checkContactAndLinks(noPhoneResume);
      const phoneFinding = res.findings.find((f) => f.id === "contact-missing-phone");
      expect(phoneFinding).toBeDefined();
      expect(phoneFinding?.severity).toBe(FindingSeverity.MEDIUM);
    });

    it("classifies missing location as LOW severity, not CRITICAL or HIGH", () => {
      const noLocationResume: any = {
        ...baseResume,
        personalInfo: {
          ...baseResume.personalInfo!,
          location: "",
        },
      };
      const res = checkContactAndLinks(noLocationResume);
      const locationFinding = res.findings.find((f) => f.id === "contact-missing-location");
      expect(locationFinding).toBeDefined();
      expect(locationFinding?.severity).toBe(FindingSeverity.LOW);
    });

    it("classifies missing LinkedIn as MEDIUM severity", () => {
      const noLinkedInResume: any = {
        ...baseResume,
        personalInfo: {
          ...baseResume.personalInfo!,
          linkedin: "",
          linkedinUrl: "",
        },
      };
      const res = checkContactAndLinks(noLinkedInResume);
      const linkedinFinding = res.findings.find((f) => f.id === "contact-missing-linkedin");
      expect(linkedinFinding).toBeDefined();
      expect(linkedinFinding?.severity).toBe(FindingSeverity.MEDIUM);
    });

    it("does not penalize missing optional GitHub", () => {
      const noGithubResume: any = {
        ...baseResume,
        personalInfo: {
          ...baseResume.personalInfo!,
          github: "",
          githubUrl: "",
        },
      };
      const res = checkContactAndLinks(noGithubResume);
      const githubFinding = res.findings.find((f) => f.id.includes("missing-github"));
      expect(githubFinding).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. Passive Voice vs Weak Action Verb vs Vague Wording (Requirements 1 & 8)
  // =========================================================================
  describe("Action Verbs & Phrasing Classification", () => {
    it("classifies 'Worked on' as WEAK_ACTION_VERB and NOT PASSIVE_VOICE", () => {
      const workedOnResume: any = {
        ...baseResume,
        experience: [
          {
            id: "exp-1",
            jobTitle: "Software Engineer",
            company: "Tech Corp",
            startDate: "2022-01",
            bullets: [
              "Worked on RAG-based product applications using LangChain and FastAPI.",
            ],
          },
        ],
      };

      const { contentResult } = checkExperienceAndContent(workedOnResume);
      const weakVerbFinding = contentResult.findings.find(
        (f) => f.id === "content-weak-action-verb-exp-1-0",
      );
      expect(weakVerbFinding).toBeDefined();
      expect(weakVerbFinding?.classification).toBe("WEAK_ACTION_VERB");
      expect(weakVerbFinding?.title).toContain("Weak action verb");
      expect(weakVerbFinding?.title).not.toContain("Passive");
    });

    it("classifies 'Explored data...' as WEAK_ACTION_VERB", () => {
      const exploredResume: any = {
        ...baseResume,
        experience: [
          {
            id: "exp-1",
            jobTitle: "Data Scientist",
            company: "Data Corp",
            startDate: "2022-01",
            bullets: [
              "Explored data distributions to evaluate model latency and accuracy.",
            ],
          },
        ],
      };

      const { contentResult } = checkExperienceAndContent(exploredResume);
      const weakVerbFinding = contentResult.findings.find(
        (f) => f.id === "content-weak-action-verb-exp-1-0",
      );
      expect(weakVerbFinding).toBeDefined();
      expect(weakVerbFinding?.classification).toBe("WEAK_ACTION_VERB");
      expect(weakVerbFinding?.title).toContain("Weak action verb");
    });

    it("correctly identifies true PASSIVE_VOICE ('was tasked with', 'were developed by')", () => {
      const passiveResume: any = {
        ...baseResume,
        experience: [
          {
            id: "exp-1",
            jobTitle: "Developer",
            company: "Agency",
            startDate: "2022-01",
            bullets: [
              "Was tasked with developing microservices for order checkout.",
            ],
          },
        ],
      };

      const { contentResult } = checkExperienceAndContent(passiveResume);
      const passiveFinding = contentResult.findings.find(
        (f) => f.id === "content-passive-voice-exp-1-0",
      );
      expect(passiveFinding).toBeDefined();
      expect(passiveFinding?.classification).toBe("PASSIVE_VOICE");
      expect(passiveFinding?.title).toContain("Passive voice detected");
    });

    it("classifies 'Responsible for' as VAGUE_WORDING", () => {
      const vagueResume: any = {
        ...baseResume,
        experience: [
          {
            id: "exp-1",
            jobTitle: "Developer",
            company: "Agency",
            startDate: "2022-01",
            bullets: [
              "Responsible for managing software deployments and cloud infrastructure.",
            ],
          },
        ],
      };

      const { contentResult } = checkExperienceAndContent(vagueResume);
      const vagueFinding = contentResult.findings.find(
        (f) => f.id === "content-vague-wording-exp-1-0",
      );
      expect(vagueFinding).toBeDefined();
      expect(vagueFinding?.classification).toBe("VAGUE_WORDING");
    });
  });

  // =========================================================================
  // 4. Technology Mention vs Skill Recommendation & Source Tracking (Req 3 & 4)
  // =========================================================================
  describe("Technology Evidence & Source Tracking", () => {
    it("tracks technology sources and flags project-only technology with conditional Fact Guard phrasing", () => {
      const resumeWithProjects: any = {
        ...baseResume,
        projects: [
          {
            id: "proj-1",
            title: "Movie Recommender System",
            technologies: ["Django", "Vercel", "Python"],
            description: "Built collaborative filtering engine.",
          },
        ],
        // Skills only has Python, not Django or Vercel
        skills: [
          {
            id: "sk-1",
            category: "Languages",
            skills: ["Python", "TypeScript"],
          },
        ],
      };

      const res = checkSkills(resumeWithProjects);

      // Verify Django is tracked with source PROJECT
      expect(res.metrics.technologySources["django"]).toBeDefined();
      expect(res.metrics.technologySources["django"].sources).toContain("PROJECT");

      // Verify Vercel is tracked with source PROJECT
      expect(res.metrics.technologySources["vercel"]).toBeDefined();
      expect(res.metrics.technologySources["vercel"].sources).toContain("PROJECT");

      // Verify finding title and wording
      const djangoFinding = res.findings.find(
        (f) => f.id === "skills-tech-project-only-django",
      );
      expect(djangoFinding).toBeDefined();
      expect(djangoFinding?.title).toBe(
        "Technology appears in project experience but is not listed in Skills.",
      );
      expect(djangoFinding?.severity).toBe(FindingSeverity.INFO);
      expect(djangoFinding?.recommendation).toBe(
        "If this represents a current skill you want recruiters to consider, consider adding it to Skills.",
      );
      // Ensure recommendation does NOT claim or imply user proficiency
      expect(djangoFinding?.recommendation).not.toContain("proficient");
    });
  });

  // =========================================================================
  // 5. Yash_Resume-(1).pdf Specific Validation (Requirement 10)
  // =========================================================================
  describe("Yash_Resume-(1).pdf Specific Validation", () => {
    const yashResume: any = {
      personalInfo: {
        fullName: "Yash Sharma",
        email: "mailto:ys136450@gmail.com",
        phone: "", // Missing phone
        location: "Delhi, India",
        linkedin: "", // Missing LinkedIn
        github: "https://github.com/yashsharma",
      },
      summary: "Experienced AI and Software Engineer specializing in RAG architectures.",
      links: [
        {
          id: "link-email",
          label: "Email",
          url: "mailto:ys136450@gmail.com",
        },
      ],
      experience: [
        {
          id: "exp-1",
          jobTitle: "AI Engineer",
          company: "NextGen AI",
          startDate: "2023-01",
          endDate: "Present",
          current: true,
          bullets: [
            "Worked on RAG-based product applications integrating vector databases.",
            "Explored data distributions to optimize query embedding retrieval.",
          ],
          technologiesUsed: ["Python", "LangChain", "FastAPI"],
        },
      ],
      education: [
        {
          id: "edu-1",
          institution: "Delhi Technological University",
          degree: "Bachelor of Technology",
          fieldOfStudy: "Computer Science",
          startDate: "2019-08",
          endDate: "2023-05",
          current: false,
        },
      ],
      projects: [
        {
          id: "proj-1",
          title: "Movie Recommender System",
          technologies: ["Django", "Vercel", "Python"],
          bullets: ["Built collaborative filtering model."],
        },
      ],
      skills: [
        {
          id: "sk-1",
          category: "Languages & Frameworks",
          skills: ["Python", "FastAPI", "LangChain"],
        },
      ],
    };

    it("verifies all expected corrections for Yash_Resume profile", () => {
      const aggregate = runAllDeterministicChecks(yashResume);

      // [x] Missing phone → valid finding (MEDIUM severity, not CRITICAL)
      const phoneFinding = aggregate.findings.find((f) => f.id === "contact-missing-phone");
      expect(phoneFinding).toBeDefined();
      expect(phoneFinding?.severity).toBe(FindingSeverity.MEDIUM);

      // [x] Missing LinkedIn → valid finding (MEDIUM severity)
      const linkedinFinding = aggregate.findings.find((f) => f.id === "contact-missing-linkedin");
      expect(linkedinFinding).toBeDefined();
      expect(linkedinFinding?.severity).toBe(FindingSeverity.MEDIUM);

      // [x] "Worked on" → WEAK_ACTION_VERB, not PASSIVE_VOICE
      const workedOnFinding = aggregate.findings.find(
        (f) => f.id === "content-weak-action-verb-exp-1-0",
      );
      expect(workedOnFinding).toBeDefined();
      expect(workedOnFinding?.classification).toBe("WEAK_ACTION_VERB");
      expect(workedOnFinding?.title).not.toContain("Passive");

      // [x] "Explored data..." → WEAK_ACTION_VERB
      const exploredFinding = aggregate.findings.find(
        (f) => f.id === "content-weak-action-verb-exp-1-1",
      );
      expect(exploredFinding).toBeDefined();
      expect(exploredFinding?.classification).toBe("WEAK_ACTION_VERB");

      // [x] Django → project-only technology
      const djangoFinding = aggregate.findings.find(
        (f) => f.id === "skills-tech-project-only-django",
      );
      expect(djangoFinding).toBeDefined();
      expect(djangoFinding?.source).toBe("PROJECT");

      // [x] Vercel → project-only technology
      const vercelFinding = aggregate.findings.find(
        (f) => f.id === "skills-tech-project-only-vercel",
      );
      expect(vercelFinding).toBeDefined();
      expect(vercelFinding?.source).toBe("PROJECT");

      // [x] mailto email → VALID (no invalid link findings)
      const invalidEmail = aggregate.findings.find(
        (f) => f.id === "contact-invalid-email" || f.id.includes("invalid-custom-link"),
      );
      expect(invalidEmail).toBeUndefined();

      // [x] Standard section headings → no issue
      const structureFindings = aggregate.findings.filter(
        (f) => f.category === ResumeQualityCategory.ATS_STRUCTURE,
      );
      expect(structureFindings).toHaveLength(0);

      // [x] Date consistency → no issue
      const consistencyFindings = aggregate.findings.filter(
        (f) => f.category === ResumeQualityCategory.CONSISTENCY,
      );
      expect(consistencyFindings).toHaveLength(0);
    });
  });

  // =========================================================================
  // 6. Existing Check Regressions
  // =========================================================================
  describe("Formatting & Consistency Regressions", () => {
    it("detects emojis accurately", () => {
      const emojiResume: any = {
        ...baseResume,
        summary: "Passionate developer 🚀 building rocket-speed software! 💻🔥",
      };
      const { result } = checkFormattingAndParseability(emojiResume, null);
      expect(result.findings.some((f) => f.id === "format-emoji-detected")).toBe(true);
    });

    it("detects identical duplicate bullets across roles", () => {
      const dupeBulletResume: any = {
        ...baseResume,
        experience: [
          {
            id: "exp-1",
            jobTitle: "Lead Dev",
            company: "Alpha Inc",
            startDate: "2022-01",
            bullets: ["Collaborated with cross-functional teams to deliver software."],
          },
          {
            id: "exp-2",
            jobTitle: "Junior Dev",
            company: "Beta LLC",
            startDate: "2020-01",
            endDate: "2021-12",
            bullets: ["Collaborated with cross-functional teams to deliver software."],
          },
        ],
      };
      const res = checkConsistencyAndDuplication(dupeBulletResume);
      expect(res.findings.some((f) => f.id === "consist-duplicate-bullets")).toBe(true);
    });
  });
});
