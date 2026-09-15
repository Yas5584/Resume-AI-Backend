import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { getDefaultTemplateConfig } from "@resumeai/shared";
import { buildApp } from "../src/app.js";
import { getPdfExporter } from "../src/export/pdf-exporter.factory.js";
import {
  puppeteerPdfResumeExporter,
  PuppeteerPdfResumeExporter,
} from "../src/export/puppeteer-pdf-exporter.js";
import {
  pdfResumeExporter,
  PdfResumeExporter,
} from "../src/export/pdf-exporter.js";
import { createRepresentativeResume } from "../src/routes/test-pdf.routes.js";
import { DocumentExtractionService } from "../src/documents/document-extractor.service.js";

const extractor = new DocumentExtractionService();

describe("Puppeteer + @sparticuz/chromium PDF Renderer Test Suite", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // 1. Factory & Configuration Tests
  describe("Renderer Selection & Configuration", () => {
    it("should default to Playwright renderer when no override or env is specified", () => {
      const exporter = getPdfExporter();
      expect(exporter).toBeInstanceOf(PdfResumeExporter);
    });

    it("should return Puppeteer renderer when explicitly requested", () => {
      const exporter = getPdfExporter("puppeteer");
      expect(exporter).toBeInstanceOf(PuppeteerPdfResumeExporter);
    });

    it("should return Playwright renderer when explicitly requested", () => {
      const exporter = getPdfExporter("playwright");
      expect(exporter).toBeInstanceOf(PdfResumeExporter);
    });
  });

  // 2. All 4 Templates Rendering with Puppeteer
  describe("All 4 ResumeAI Templates via Puppeteer", () => {
    const templates = [
      { id: "modern-standard", name: "Modern Standard" },
      { id: "classic-serif", name: "Classic Serif" },
      { id: "minimal-clean", name: "Minimal Clean" },
      { id: "executive-leadership", name: "Executive Leadership" },
    ] as const;

    for (const t of templates) {
      it(`should successfully render template '${t.name}' (${t.id})`, async () => {
        const resumeData = createRepresentativeResume("normal");
        const templateConfig = getDefaultTemplateConfig(t.id);

        const result = await puppeteerPdfResumeExporter.export(
          resumeData,
          templateConfig,
          `Test Resume - ${t.name}`,
        );

        // 1. Buffer validity
        expect(result.buffer).toBeInstanceOf(Buffer);
        expect(result.buffer.length).toBeGreaterThan(10000);
        expect(result.mimeType).toBe("application/pdf");

        // 2. PDF Header Signature (%PDF-)
        const header = result.buffer.subarray(0, 5).toString("utf-8");
        expect(header).toBe("%PDF-");

        // 3. Extract and verify text
        const extracted = await extractor.extractPdf(result.buffer);
        expect(extracted.pageCount).toBeGreaterThanOrEqual(1);

        const fullText = extracted.rawText.toUpperCase();
        expect(fullText).toContain("YASH SHARMA");
        expect(fullText).toContain("EXPERIENCE");
        expect(fullText).toContain("PROJECTS");
        expect(fullText).toContain("SKILLS");
      }, 30000);
    }
  });

  // 3. Length & Page Break Testing
  describe("Length, Pagination & Page Break Testing", () => {
    it("should render a compact 1-page resume without overflowing", async () => {
      const shortData = createRepresentativeResume("short");
      const config = getDefaultTemplateConfig("modern-standard");

      const result = await puppeteerPdfResumeExporter.export(
        shortData,
        config,
        "Short 1-Page Resume",
      );

      const extracted = await extractor.extractPdf(result.buffer);
      expect(extracted.pageCount).toBe(1);
      expect(extracted.rawText.toUpperCase()).toContain("YASH SHARMA");
    }, 30000);

    it("should render a comprehensive long resume across multiple pages with intact sections", async () => {
      const longData = createRepresentativeResume("long");
      const config = getDefaultTemplateConfig("modern-standard");

      const result = await puppeteerPdfResumeExporter.export(
        longData,
        config,
        "Long Multi-Page Resume",
      );

      const extracted = await extractor.extractPdf(result.buffer);
      // Multi-page resume with 4 experiences and 3 projects should span 2 or 3 pages
      expect(extracted.pageCount).toBeGreaterThanOrEqual(2);

      const fullText = extracted.rawText.toUpperCase();
      expect(fullText).toContain("YASH SHARMA");
      expect(fullText).toContain("APEX AI");
      expect(fullText).toContain("CLOUDSCALE");
      expect(fullText).toContain("NEXTGEN MOBILITY");
      expect(fullText).toContain("VANGUARD SOFTWARE");
      expect(fullText).toContain("CERTIFICATIONS");
    }, 30000);

    it("should support both A4 and Letter page formats", async () => {
      const data = createRepresentativeResume("normal");

      const letterConfig = {
        ...getDefaultTemplateConfig("modern-standard"),
        pageSize: "letter" as const,
      };
      const a4Config = {
        ...getDefaultTemplateConfig("modern-standard"),
        pageSize: "a4" as const,
      };

      const letterResult = await puppeteerPdfResumeExporter.export(
        data,
        letterConfig,
        "Letter Resume",
      );
      const a4Result = await puppeteerPdfResumeExporter.export(
        data,
        a4Config,
        "A4 Resume",
      );

      expect(letterResult.buffer.length).toBeGreaterThan(10000);
      expect(a4Result.buffer.length).toBeGreaterThan(10000);

      const letterExtracted = await extractor.extractPdf(letterResult.buffer);
      const a4Extracted = await extractor.extractPdf(a4Result.buffer);

      expect(letterExtracted.pageCount).toBeGreaterThanOrEqual(1);
      expect(a4Extracted.pageCount).toBeGreaterThanOrEqual(1);
    }, 30000);
  });

  // 4. Semantic Comparison: Playwright vs Puppeteer
  describe("Semantic Comparison: Playwright vs Puppeteer", () => {
    it("should generate visually comparable PDFs with identical semantic content", async () => {
      const data = createRepresentativeResume("normal");
      const config = getDefaultTemplateConfig("modern-standard");

      // Render with Playwright
      const playwrightResult = await pdfResumeExporter.export(
        data,
        config,
        "Playwright Comparison",
      );

      // Render with Puppeteer
      const puppeteerResult = await puppeteerPdfResumeExporter.export(
        data,
        config,
        "Puppeteer Comparison",
      );

      const pwExtracted = await extractor.extractPdf(playwrightResult.buffer);
      const ppExtracted = await extractor.extractPdf(puppeteerResult.buffer);

      // Both should have valid page counts
      expect(pwExtracted.pageCount).toBeGreaterThanOrEqual(1);
      expect(ppExtracted.pageCount).toBeGreaterThanOrEqual(1);

      // Page counts should match exactly for normal resume
      expect(ppExtracted.pageCount).toBe(pwExtracted.pageCount);

      // Verify core text is identical across both
      const pwText = pwExtracted.rawText.toUpperCase();
      const ppText = ppExtracted.rawText.toUpperCase();

      const requiredStrings = [
        "YASH SHARMA",
        "LEAD SOFTWARE ENGINEER",
        "APEX AI TECHNOLOGIES",
        "SENIOR BACKEND DEVELOPER",
        "CLOUDSCALE SYSTEMS",
        "RESUMEAI AUTOMATED CAREER SUITE",
        "DISTRIBUTED TASK ORCHESTRATOR",
        "EDUCATION",
        "AWS CERTIFIED SOLUTIONS ARCHITECT",
        "PROFESSIONAL CLOUD DEVELOPER",
      ];

      for (const str of requiredStrings) {
        expect(pwText).toContain(str);
        expect(ppText).toContain(str);
      }

      // Buffer sizes should be comparable (within 40% of each other)
      const ratio = puppeteerResult.buffer.length / playwrightResult.buffer.length;
      expect(ratio).toBeGreaterThan(0.6);
      expect(ratio).toBeLessThan(1.5);
    }, 45000);
  });

  // 5. Temporary Test Endpoint Verification
  describe("Test Endpoint GET /api/test/pdf-puppeteer", () => {
    it("should successfully serve generated PDF with application/pdf content type", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/test/pdf-puppeteer?template=modern-standard&length=normal",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("application/pdf");
      expect(response.headers["x-pdf-renderer"]).toBe("puppeteer");
      expect(response.headers["x-template-id"]).toBe("modern-standard");

      const buffer = response.rawPayload;
      expect(buffer.length).toBeGreaterThan(10000);
      expect(buffer.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
    }, 30000);

    it("should support query params template=classic-serif and length=short", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/test/pdf-puppeteer?template=classic-serif&length=short",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("application/pdf");
      expect(response.headers["x-template-id"]).toBe("classic-serif");
      expect(response.headers["x-resume-length"]).toBe("short");
    }, 30000);
  });

  // 6. Performance Benchmarks across 10 generations
  describe("Performance Benchmarks (10 Generations)", () => {
    it("should run 10 Puppeteer PDF generations and record performance metrics", async () => {
      const resumeData = createRepresentativeResume("normal");
      const templateConfig = getDefaultTemplateConfig("modern-standard");

      const samples: number[] = [];
      const startupSamples: number[] = [];
      const renderSamples: number[] = [];
      let lastSize = 0;

      for (let i = 0; i < 10; i++) {
        const { metrics } = await puppeteerPdfResumeExporter.exportWithMetrics(
          resumeData,
          templateConfig,
          `Bench-${i}`,
        );

        samples.push(metrics.totalMs);
        startupSamples.push(metrics.browserStartupMs);
        renderSamples.push(metrics.pdfRenderMs);
        lastSize = metrics.pdfSizeBytes;
      }

      expect(samples.length).toBe(10);
      const sum = samples.reduce((a, b) => a + b, 0);
      const avg = Math.round(sum / samples.length);
      const min = Math.min(...samples);
      const max = Math.max(...samples);

      const avgStartup = Math.round(
        startupSamples.reduce((a, b) => a + b, 0) / startupSamples.length,
      );
      const avgRender = Math.round(
        renderSamples.reduce((a, b) => a + b, 0) / renderSamples.length,
      );

      console.log("\n==========================================");
      console.log("PUPPETEER PDF GENERATION BENCHMARKS (10 RUNS)");
      console.log("==========================================");
      console.log(`Average Total Time:     ${avg} ms`);
      console.log(`Min Total Time:         ${min} ms`);
      console.log(`Max Total Time:         ${max} ms`);
      console.log(`Avg Browser Startup:    ${avgStartup} ms`);
      console.log(`Avg PDF Render:         ${avgRender} ms`);
      console.log(`Average PDF File Size:  ${Math.round(lastSize / 1024)} KB`);
      console.log("==========================================\n");

      // Expect total time to complete within reasonable bounds (< 15 seconds per generation)
      expect(avg).toBeLessThan(15000);
      expect(lastSize).toBeGreaterThan(10000);
    }, 120000);
  });
});
