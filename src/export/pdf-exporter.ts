import { chromium, Browser } from "playwright";
import { ResumeData, TemplateConfig } from "@resumeai/shared";
import { ExportResult, ResumeExporter } from "./exporter.interface.js";
import { renderResumeToHtml } from "./html-renderer.js";
import { sanitizeFilename } from "./sanitize-filename.js";

const CONTAINER_CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

async function launchBrowser(): Promise<Browser> {
  // In Linux / Production container environments (Railway, Docker), use bundled Chromium with container flags
  if (process.platform === "linux" || process.env.NODE_ENV === "production") {
    try {
      return await chromium.launch({
        headless: true,
        args: CONTAINER_CHROMIUM_ARGS,
      });
    } catch (err: any) {
      console.warn(
        `Standard chromium launch notice: ${err?.message}. Trying fallback...`,
      );
    }
  }

  // Windows / Dev: Prefer system-installed browsers for performance & zero extra download
  try {
    return await chromium.launch({
      headless: true,
      channel: "chrome",
      args: CONTAINER_CHROMIUM_ARGS,
    });
  } catch {
    try {
      return await chromium.launch({
        headless: true,
        channel: "msedge",
        args: CONTAINER_CHROMIUM_ARGS,
      });
    } catch {
      return await chromium.launch({
        headless: true,
        args: CONTAINER_CHROMIUM_ARGS,
      });
    }
  }
}

export class PdfResumeExporter implements ResumeExporter {
  async export(
    resumeData: ResumeData,
    templateConfig: TemplateConfig,
    title: string,
  ): Promise<ExportResult> {
    const html = renderResumeToHtml(resumeData, templateConfig, title);
    const filename = sanitizeFilename(
      title || resumeData.personalInfo?.fullName,
      "pdf",
    );

    let browser: Browser | null = null;
    try {
      browser = await launchBrowser();
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.setContent(html, { waitUntil: "load" });
      await page.emulateMedia({ media: "print" });

      const pdfUint8Array = await page.pdf({
        format: templateConfig.pageSize === "a4" ? "A4" : "Letter",
        printBackground: true,
        preferCSSPageSize: true,
      });

      const buffer = Buffer.from(pdfUint8Array);

      return {
        buffer,
        mimeType: "application/pdf",
        filename,
      };
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }
}

export const pdfResumeExporter = new PdfResumeExporter();
