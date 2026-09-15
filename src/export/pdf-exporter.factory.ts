import { ResumeExporter } from "./exporter.interface.js";
import { pdfResumeExporter, PdfResumeExporter } from "./pdf-exporter.js";
import {
  puppeteerPdfResumeExporter,
  PuppeteerPdfResumeExporter,
} from "./puppeteer-pdf-exporter.js";
import { env } from "../config/index.js";

export type PdfRendererType = "playwright" | "puppeteer";

/**
 * Factory that returns the active PDF ResumeExporter based on environment or explicit override.
 * Default MUST remain "playwright".
 */
export function getPdfExporter(
  override?: PdfRendererType,
): ResumeExporter {
  const selected = override || env.PDF_RENDERER || "playwright";

  switch (selected) {
    case "puppeteer":
      return puppeteerPdfResumeExporter;
    case "playwright":
    default:
      return pdfResumeExporter;
  }
}

export {
  pdfResumeExporter,
  PdfResumeExporter,
  puppeteerPdfResumeExporter,
  PuppeteerPdfResumeExporter,
};
