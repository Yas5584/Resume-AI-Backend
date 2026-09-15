import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  ResumeData,
  TemplateConfig,
  getDefaultTemplateConfig,
  createDefaultResumeData,
} from "@resumeai/shared";
import { puppeteerPdfResumeExporter } from "../export/puppeteer-pdf-exporter.js";
import { pdfResumeExporter } from "../export/pdf-exporter.js";
import { env } from "../config/index.js";

export function createRepresentativeResume(
  length: "short" | "normal" | "long" = "normal",
): ResumeData {
  const resume = createDefaultResumeData("Yash Sharma");

  resume.personalInfo = {
    fullName: "Yash Sharma",
    headline: "Senior Full-Stack & AI Systems Engineer",
    email: "yash.sharma@example.com",
    phone: "+1 (555) 342-8901",
    location: "San Francisco, CA",
    website: "https://yashsharma.dev",
    linkedin: "https://linkedin.com/in/yash-sharma-dev",
    github: "https://github.com/yash-sharma",
    linkedinUrl: "https://linkedin.com/in/yash-sharma-dev",
    githubUrl: "https://github.com/yash-sharma",
    portfolioUrl: "https://yashsharma.dev",
  };

  const summaryMap = {
    short:
      "Full-Stack Engineer with 6+ years building scalable cloud platforms and high-throughput microservices using TypeScript, Node.js, and React.",
    normal:
      "Senior Full-Stack Engineer with 6+ years of experience designing high-concurrency microservices, AI-powered developer workflows, and enterprise web applications. Proven record leading distributed teams and scaling infrastructure to handle 10M+ daily API transactions with 99.99% uptime.",
    long:
      "Accomplished Senior AI & Full-Stack Systems Engineer with 8+ years specializing in distributed systems, real-time LLM inference pipelines, and fault-tolerant cloud backends. Deep expertise in Node.js, Fastify, Next.js, PostgreSQL, and container orchestration. Passionate about automated testing, zero-downtime migrations, and deterministic guardrail architectures for mission-critical enterprise applications.",
  };

  resume.summary = summaryMap[length] || summaryMap.normal;

  const experiences = [
    {
      id: "exp-1",
      company: "Apex AI Technologies",
      jobTitle: "Lead Software Engineer",
      position: "Lead Software Engineer",
      location: "San Francisco, CA",
      employmentType: "Full-time",
      startDate: "2023-01",
      endDate: "",
      current: true,
      description: "Lead software architecture and AI infrastructure.",
      bullets: [
        "Architected and deployed distributed AI inference microservices processing over 50,000 requests per minute with p95 latency under 120ms.",
        "Engineered zero-hallucination Fact Guard pipeline integrating multi-agent LLM verification with strict PostgreSQL foreign-key constraints.",
        "Spearheaded database query optimization reducing connection pool saturation by 42% across multi-tenant clusters.",
      ],
      technologiesUsed: ["Node.js", "TypeScript", "PostgreSQL", "Docker"],
    },
    {
      id: "exp-2",
      company: "CloudScale Systems",
      jobTitle: "Senior Backend Developer",
      position: "Senior Backend Developer",
      location: "Austin, TX",
      employmentType: "Full-time",
      startDate: "2020-03",
      endDate: "2022-12",
      current: false,
      description: "Core backend services and distributed worker queues.",
      bullets: [
        "Designed and maintained event-driven workflow engine using BullMQ and Redis handling 1.2M daily background jobs.",
        "Refactored monolithic REST API into decoupled Fastify services, improving system test coverage from 64% to 98%.",
        "Configured CI/CD pipelines on GitHub Actions reducing deployment turnaround time from 28 minutes to 4 minutes.",
      ],
      technologiesUsed: ["Fastify", "Redis", "BullMQ", "PostgreSQL"],
    },
  ];

  if (length === "long") {
    experiences.push(
      {
        id: "exp-3",
        company: "NextGen Mobility",
        jobTitle: "Software Engineer",
        position: "Software Engineer",
        location: "Seattle, WA",
        employmentType: "Full-time",
        startDate: "2018-06",
        endDate: "2020-02",
        current: false,
        description: "Telemetry platforms and fleet management dashboards.",
        bullets: [
          "Developed high-traffic React dashboard with real-time WebSocket telemetry for 250,000 active fleet vehicles.",
          "Integrated OAuth2 / OIDC authentication with secure HttpOnly cookie persistence and role-based access control.",
          "Collaborated with product designers to implement compliant accessibility standards (WCAG 2.1 AA).",
        ],
        technologiesUsed: ["React", "TypeScript", "WebSockets"],
      },
      {
        id: "exp-4",
        company: "Vanguard Software Labs",
        jobTitle: "Junior Developer",
        position: "Junior Developer",
        location: "Boston, MA",
        employmentType: "Full-time",
        startDate: "2016-08",
        endDate: "2018-05",
        current: false,
        description: "API testing and automated documentation tooling.",
        bullets: [
          "Implemented automated unit and end-to-end integration tests using Vitest and Playwright.",
          "Authored comprehensive API documentation adhering to OpenAPI / Swagger specifications.",
        ],
        technologiesUsed: ["JavaScript", "Node.js", "Git"],
      },
    );
  }

  resume.experience = length === "short" ? experiences.slice(0, 1) : experiences;

  const projects = [
    {
      id: "proj-1",
      name: "ResumeAI Automated Career Suite",
      role: "Lead Engineer",
      description:
        "Engineered an enterprise ATS-friendly resume generation platform with real-time Fact Guard hallucination prevention and dynamic headless PDF rendering.",
      technologies: [
        "TypeScript",
        "Fastify",
        "Next.js 15",
        "PostgreSQL",
        "Prisma",
        "Docker",
      ],
      startDate: "2024-01",
      endDate: "",
      url: "https://resumeai.dev",
      repoUrl: "https://github.com/yash-sharma/resumeai",
      bullets: [
        "Built multi-tenant Fastify REST API and Next.js 15 SSR dashboard with sub-100ms response times.",
        "Integrated dual-engine Playwright and Puppeteer PDF exporters with strict CSS page-break constraints.",
      ],
      highlights: ["5,000+ active users", "99.9% uptime"],
    },
    {
      id: "proj-2",
      name: "Distributed Task Orchestrator",
      role: "Creator",
      description:
        "Created an open-source distributed queue manager with automatic Redis failover and dead-letter queue visualization.",
      technologies: ["Node.js", "Redis", "BullMQ", "React", "TailwindCSS"],
      startDate: "2023-06",
      endDate: "2023-12",
      url: "https://task-orchestrator.dev",
      repoUrl: "https://github.com/yash-sharma/task-orchestrator",
      bullets: [
        "Implemented exponential backoff retry policies and graceful process drain on SIGTERM signals.",
      ],
      highlights: ["1,200 GitHub stars"],
    },
  ];

  if (length === "long") {
    projects.push({
      id: "proj-3",
      name: "Neural Search Vector Pipeline",
      role: "Author",
      description:
        "High-performance semantic vector indexer connecting Milvus embeddings to PostgreSQL metadata for ultra-fast document search.",
      technologies: ["Python", "FastAPI", "Milvus", "Docker", "PyTorch"],
      startDate: "2022-01",
      endDate: "2022-06",
      url: "https://neural-search.dev",
      repoUrl: "https://github.com/yash-sharma/neural-search",
      bullets: ["Benchmarked query latency at 8ms across 1M embedding vectors."],
      highlights: ["Published technical whitepaper"],
    });
  }

  resume.projects = length === "short" ? projects.slice(0, 1) : projects;

  resume.skills = [
    {
      id: "skill-1",
      category: "Languages",
      skills: ["TypeScript", "JavaScript", "Python", "SQL", "HTML5/CSS3"],
    },
    {
      id: "skill-2",
      category: "Backend & Databases",
      skills: ["Node.js", "Fastify", "Express", "PostgreSQL", "Redis", "Prisma ORM"],
    },
    {
      id: "skill-3",
      category: "Frontend",
      skills: ["React 19", "Next.js 15", "TailwindCSS", "HTML5", "CSS Modules"],
    },
    {
      id: "skill-4",
      category: "DevOps & Cloud",
      skills: ["Docker", "Vercel", "AWS (EC2, S3)", "Git", "GitHub Actions", "Linux"],
    },
  ];

  resume.education = [
    {
      id: "edu-1",
      institution: "University of California, Berkeley",
      degree: "Bachelor of Science in Computer Science",
      fieldOfStudy: "Computer Science",
      location: "Berkeley, CA",
      startDate: "2012-09",
      endDate: "2016-05",
      current: false,
      gpa: "3.85",
      description: "Focus on distributed systems and algorithm design.",
      honors: ["Dean's Honors List", "President of Software Engineering Club"],
    },
  ];

  if (length !== "short") {
    resume.certifications = [
      {
        id: "cert-1",
        name: "AWS Certified Solutions Architect – Associate",
        issuer: "Amazon Web Services",
        issueDate: "2023-04",
        expirationDate: "2026-04",
        credentialId: "AWS-PSA-89421",
        credentialUrl: "https://aws.amazon.com/verification",
      },
      {
        id: "cert-2",
        name: "Professional Cloud Developer",
        issuer: "Google Cloud",
        issueDate: "2022-09",
        expirationDate: "2025-09",
        credentialId: "GCP-CD-44219",
        credentialUrl: "https://cloud.google.com/certification",
      },
    ];
  }

  return resume;
}

export const testPdfRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Test route: GET /api/test/pdf-puppeteer
  app.get("/pdf-puppeteer", async (request, reply) => {
    // Safety check: Test endpoint disabled in production unless explicitly enabled
    if (env.NODE_ENV === "production" && process.env.ENABLE_TEST_ENDPOINTS !== "true") {
      return reply.status(403).send({
        error: {
          code: "FORBIDDEN",
          message: "Test endpoints are disabled in production environment.",
        },
      });
    }

    const query = request.query as Record<string, string | undefined>;
    const templateId = (query.template || "modern-standard") as
      | "modern-standard"
      | "classic-serif"
      | "minimal-clean"
      | "executive-leadership";
    const length = (query.length || "normal") as "short" | "normal" | "long";
    const pageSize = (query.pageSize === "a4" ? "a4" : "letter") as "a4" | "letter";
    const renderer = query.renderer === "playwright" ? "playwright" : "puppeteer";

    const resumeData = createRepresentativeResume(length);
    const templateConfig: TemplateConfig = {
      ...getDefaultTemplateConfig(templateId),
      pageSize,
    };

    const title = `${resumeData.personalInfo?.fullName || "Resume"} - ${templateId} (${length})`;

    const exporter =
      renderer === "playwright" ? pdfResumeExporter : puppeteerPdfResumeExporter;

    try {
      const result = await exporter.export(resumeData, templateConfig, title);

      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        `inline; filename="${result.filename}"`,
      );
      reply.header("X-Pdf-Renderer", renderer);
      reply.header("X-Template-Id", templateId);
      reply.header("X-Resume-Length", length);

      return reply.send(result.buffer);
    } catch (err: any) {
      app.log.error(`PDF generation test error: ${err.message}`);
      return reply.status(500).send({
        error: {
          code: "PDF_RENDER_ERROR",
          message: `PDF rendering failed with ${renderer}: ${err.message}`,
        },
      });
    }
  });

  // Benchmark route: GET /api/test/pdf-benchmark
  app.get("/pdf-benchmark", async (request, reply) => {
    if (env.NODE_ENV === "production" && process.env.ENABLE_TEST_ENDPOINTS !== "true") {
      return reply.status(403).send({ error: "Disabled in production" });
    }

    const resumeData = createRepresentativeResume("normal");
    const templateConfig = getDefaultTemplateConfig("modern-standard");

    try {
      const puppeteerMetrics = await puppeteerPdfResumeExporter.exportWithMetrics(
        resumeData,
        templateConfig,
        "Benchmark Resume",
      );

      return reply.send({
        status: "ok",
        renderer: "puppeteer-core + @sparticuz/chromium",
        metrics: puppeteerMetrics.metrics,
      });
    } catch (err: any) {
      return reply.status(500).send({
        status: "error",
        message: err.message,
      });
    }
  });
};
