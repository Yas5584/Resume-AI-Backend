import puppeteer, { Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import fs from "fs";
import { ResumeData, TemplateConfig } from "@resumeai/shared";
import { ExportResult, ResumeExporter } from "./exporter.interface.js";
import { renderResumeToHtml } from "./html-renderer.js";
import { sanitizeFilename } from "./sanitize-filename.js";

const DEFAULT_SERVERLESS_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-extensions",
  "--no-first-run",
  "--no-zygote",
];

export interface PuppeteerRenderMetrics {
  browserStartupMs: number;
  pageCreationMs: number;
  htmlLoadMs: number;
  fontWaitMs: number;
  pdfRenderMs: number;
  totalMs: number;
  pdfSizeBytes: number;
  executablePathUsed: string;
}

export interface PuppeteerExportWithMetrics {
  result: ExportResult;
  metrics: PuppeteerRenderMetrics;
}

/**
 * Finds an available local Chrome or Edge executable on Windows / macOS
 * for local development and test runs where @sparticuz/chromium's Linux binary cannot execute.
 */
function findLocalBrowserExecutable(): string | null {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  if (
    process.env.PUPPETEER_EXECUTABLE_PATH &&
    fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)
  ) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  if (process.platform === "win32") {
    const candidatePaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (process.platform === "darwin") {
    const candidatePaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  return null;
}

/**
 * Resolves the appropriate Chromium executable path:
 * - On Linux (including Vercel Serverless Functions / AWS Lambda): @sparticuz/chromium
 * - On Windows / macOS (local development): local Chrome / Edge executable
 */
export async function resolveChromiumExecutable(): Promise<string> {
  // In Linux / Production / Serverless environments, use @sparticuz/chromium
  if (process.platform === "linux") {
    try {
      const sparticuzPath = await chromium.executablePath();
      if (sparticuzPath) {
        return sparticuzPath;
      }
    } catch (err: any) {
      console.warn(
        `[PuppeteerPDF] @sparticuz/chromium resolution warning: ${err?.message}`,
      );
    }
  }

  // Local development fallback for Windows and macOS
  const localPath = findLocalBrowserExecutable();
  if (localPath) {
    return localPath;
  }

  // Final attempt with @sparticuz/chromium
  try {
    const sparticuzPath = await chromium.executablePath();
    if (sparticuzPath) {
      return sparticuzPath;
    }
  } catch (err: any) {
    throw new Error(
      `Could not resolve Chromium executable for Puppeteer: ${err?.message}. Please install Chrome or set CHROME_PATH.`,
    );
  }

  throw new Error(
    "Could not resolve Chromium executable for Puppeteer. Please install Chrome or set CHROME_PATH.",
  );
}

/**
 * Launches a Puppeteer browser instance with serverless-safe flags and reliable cleanup.
 */
export async function launchPuppeteerBrowser(): Promise<{
  browser: Browser;
  executablePathUsed: string;
}> {
  const executablePath = await resolveChromiumExecutable();

  // Combine @sparticuz/chromium flags with required container safety flags
  const chromiumArgs = Array.isArray(chromium.args) ? chromium.args : [];
  const args = Array.from(
    new Set([...chromiumArgs, ...DEFAULT_SERVERLESS_ARGS]),
  );

  const browser = await puppeteer.launch({
    executablePath,
    args,
    headless: true,
  });

  return { browser, executablePathUsed: executablePath };
}

export class PuppeteerPdfResumeExporter implements ResumeExporter {
  async export(
    resumeData: ResumeData,
    templateConfig: TemplateConfig,
    title: string,
  ): Promise<ExportResult> {
    const { result } = await this.exportWithMetrics(
      resumeData,
      templateConfig,
      title,
    );
    return result;
  }

  async exportWithMetrics(
    resumeData: ResumeData,
    templateConfig: TemplateConfig,
    title: string,
  ): Promise<PuppeteerExportWithMetrics> {
    const totalStart = performance.now();
    const html = renderResumeToHtml(resumeData, templateConfig, title);
    const filename = sanitizeFilename(
      title || resumeData.personalInfo?.fullName,
      "pdf",
    );

    let browser: Browser | null = null;
    let executablePathUsed = "";

    try {
      // 1. Launch browser
      const startupStart = performance.now();
      const launchResult = await launchPuppeteerBrowser();
      browser = launchResult.browser;
      executablePathUsed = launchResult.executablePathUsed;
      const browserStartupMs = performance.now() - startupStart;

      // 2. Create Page
      const pageStart = performance.now();
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
      const pageCreationMs = performance.now() - pageStart;

      // 3. Set Content
      const htmlStart = performance.now();
      await page.setContent(html, {
        waitUntil: "load",
        timeout: 30000,
      });
      const htmlLoadMs = performance.now() - htmlStart;

      // 4. Wait for fonts
      const fontStart = performance.now();
      try {
        await page.evaluate(() => (globalThis as any).document?.fonts?.ready);
      } catch {
        // Fallback gracefully if fonts.ready is unsupported
      }
      const fontWaitMs = performance.now() - fontStart;

      // 5. Render PDF
      const pdfStart = performance.now();
      const isA4 = templateConfig.pageSize === "a4";
      const pdfUint8Array = await page.pdf({
        format: isA4 ? "A4" : "Letter",
        printBackground: true,
        preferCSSPageSize: true,
        timeout: 30000,
      });
      const pdfRenderMs = performance.now() - pdfStart;

      const buffer = Buffer.from(pdfUint8Array);
      const totalMs = performance.now() - totalStart;

      return {
        result: {
          buffer,
          mimeType: "application/pdf",
          filename,
        },
        metrics: {
          browserStartupMs: Math.round(browserStartupMs),
          pageCreationMs: Math.round(pageCreationMs),
          htmlLoadMs: Math.round(htmlLoadMs),
          fontWaitMs: Math.round(fontWaitMs),
          pdfRenderMs: Math.round(pdfRenderMs),
          totalMs: Math.round(totalMs),
          pdfSizeBytes: buffer.length,
          executablePathUsed,
        },
      };
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }
}

export const puppeteerPdfResumeExporter = new PuppeteerPdfResumeExporter();
