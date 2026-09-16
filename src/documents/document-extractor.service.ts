import mammoth from "mammoth";
import {
  DocumentExtractor,
  ExtractedDocument,
  ExtractedPage,
} from "./document-extractor.interface.js";

/**
 * Production Document Extraction Service.
 * Implements high-fidelity extraction preserving:
 * - Exact page counts and per-page boundaries (<RESUME_PAGE_N>)
 * - Two-column layout reading order (avoiding interleaving)
 * - Bullets (•, -, *, ▪, ◦, →) and numbered lists
 * - DOCX tables, formatted lists, and hyperlinks via Markdown
 * - Scanned/image-only PDF detection (IMAGE_ONLY_DOCUMENT)
 */
export class DocumentExtractionService implements DocumentExtractor {
  async extractPdf(buffer: Buffer): Promise<ExtractedDocument> {
    if (!(globalThis as any).pdfjsWorker) {
      try {
        // @ts-ignore - dynamic worker import for Node.js / Vercel Lambda
        const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
        (globalThis as any).pdfjsWorker = worker;
      } catch {
        // Allow fallback if worker import fails
      }
    }

    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    let doc: any;
    try {
      doc = await (parser as any).load();
    } catch (err: any) {
      await parser.destroy().catch(() => {});
      throw new Error(
        `Failed to read PDF structure: ${err?.message || "corrupted file"}`,
      );
    }

    const actualPageCount = doc?.numPages || 1;
    const pages: ExtractedPage[] = [];
    const warnings: string[] = [];
    let containsImages = false;

    for (let pageNum = 1; pageNum <= actualPageCount; pageNum++) {
      try {
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent({
          includeMarkedContent: false,
        });

        // Check for embedded images in operator list
        try {
          const opList = await page.getOperatorList();
          if (opList?.fnArray) {
            // Check for image paint operators: 82 (paintImageXObject), 83 (paintInlineImageXObject)
            const hasImg = opList.fnArray.some(
              (fn: number) => fn === 82 || fn === 83,
            );
            if (hasImg) containsImages = true;
          }
        } catch {}

        // Fetch hyperlink annotations
        const hyperlinks: Array<{
          text?: string;
          url: string;
          rect?: number[];
        }> = [];
        try {
          const annotations =
            (await page.getAnnotations({ intent: "display" })) || [];
          for (const annot of annotations) {
            if (annot.subtype === "Link" && (annot.url || annot.unsafeUrl)) {
              const url = annot.url || annot.unsafeUrl;
              hyperlinks.push({
                url,
                rect: annot.rect,
              });
            }
          }
        } catch {}

        // Extract text items with coordinate data
        const rawItems = (textContent.items || [])
          .filter((it: any) => it.str && typeof it.str === "string")
          .map((it: any) => ({
            str: it.str,
            x: it.transform ? it.transform[4] : 0,
            y: it.transform ? it.transform[5] : 0,
            width: it.width || 0,
            height: it.height || 0,
          }));

        // Clean items (trim empty whitespace)
        const items = rawItems.filter((it: any) => it.str.trim().length > 0);

        if (items.length === 0) {
          pages.push({
            pageNumber: pageNum,
            text: "",
            characterCount: 0,
            wordCount: 0,
            hasColumns: false,
          });
          page.cleanup();
          continue;
        }

        // --- Column Detection ---
        // Analyze if the page contains a distinct 2-column layout
        const pageWidth = viewport.width || 612;
        const midThreshold = pageWidth * 0.48;
        const leftItems = items.filter(
          (it: any) => it.x + it.width <= midThreshold + 20,
        );
        const rightItems = items.filter((it: any) => it.x >= midThreshold - 20);

        // A page is considered 2-column if both columns have at least 8 items
        // and together account for the majority of non-header text items
        const isTwoColumn =
          leftItems.length >= 8 &&
          rightItems.length >= 8 &&
          (leftItems.length + rightItems.length) / items.length >= 0.75;

        let pageText = "";

        if (isTwoColumn) {
          // Extract Left Column top-to-bottom
          const leftLines = this.groupItemsIntoLines(leftItems);
          const leftText = leftLines.join("\n");

          // Extract Right Column top-to-bottom
          const rightLines = this.groupItemsIntoLines(rightItems);
          const rightText = rightLines.join("\n");

          // Any header spanning full width above both columns
          const topSpanningItems = items.filter(
            (it: any) =>
              it.y > Math.max(...leftItems.map((i: any) => i.y)) &&
              it.y > Math.max(...rightItems.map((i: any) => i.y)),
          );
          const headerLines = this.groupItemsIntoLines(topSpanningItems);
          const headerText =
            headerLines.length > 0 ? headerLines.join("\n") + "\n\n" : "";

          pageText = `${headerText}${leftText}\n\n${rightText}`.trim();
        } else {
          // Standard single column or unified page: sort top-to-bottom, left-to-right
          const lines = this.groupItemsIntoLines(items);
          pageText = lines.join("\n").trim();
        }

        // Normalize encoding artifacts (UTF-8 moji-bake dashes, quotes, bullets)
        pageText = this.normalizeEncodingArtifacts(pageText);

        // Normalize bullets (•, -, *, ▪, ◦, →)
        pageText = this.normalizeBullets(pageText);

        // Inject hyperlinks if visible text matches or if link annotations exist
        for (const link of hyperlinks) {
          if (link.url && !pageText.includes(link.url)) {
            // If URL not already visible in text, append at end of contact / page
            pageText += `\n[Link](${link.url})`;
          }
        }

        const words = pageText.split(/\s+/).filter(Boolean);
        pages.push({
          pageNumber: pageNum,
          text: pageText,
          characterCount: pageText.length,
          wordCount: words.length,
          hasColumns: isTwoColumn,
        });

        page.cleanup();
      } catch (pageErr: any) {
        warnings.push(
          `Warning on page ${pageNum}: ${pageErr?.message || "could not extract page"}`,
        );
      }
    }

    let meta: Record<string, any> = {};
    try {
      const infoResult = await parser.getInfo();
      meta = (infoResult.metadata as Record<string, any>) || {};
    } catch {}

    await parser.destroy().catch(() => {});

    // Calculate totals
    const totalCharacters = pages.reduce((acc, p) => acc + p.characterCount, 0);
    const totalWords = pages.reduce((acc, p) => acc + p.wordCount, 0);
    const rawText = pages
      .map((p) => p.text)
      .filter(Boolean)
      .join("\n\n");

    // Build structured text with page boundaries
    const structuredText = pages
      .map(
        (p) =>
          `<RESUME_PAGE_${p.pageNumber}>\n${p.text}\n</RESUME_PAGE_${p.pageNumber}>`,
      )
      .join("\n\n");

    // Scanned / Image-only detection
    // If there is practically no text (< 50 chars or < 10 words) but there are pages (especially with image operators)
    const isScannedOrImageOnly =
      actualPageCount > 0 && (totalWords < 10 || totalCharacters < 50);

    if (pages.length !== actualPageCount) {
      warnings.push(
        `Extracted page count (${pages.length}) differs from actual page count (${actualPageCount}).`,
      );
    }

    return {
      fileType: "pdf",
      pageCount: pages.length,
      actualPageCount,
      pages,
      totalCharacters,
      totalWords,
      rawText: rawText.replace(/\0/g, ""),
      structuredText: structuredText.replace(/\0/g, ""),
      warnings,
      isScannedOrImageOnly,
      metadata: {
        author: meta?.Author || undefined,
        title: meta?.Title || undefined,
        creationDate: meta?.CreationDate || undefined,
        wordCount: totalWords,
        mimeType: "application/pdf",
        containsImages,
      },
    };
  }

  async extractDocx(buffer: Buffer): Promise<ExtractedDocument> {
    const warnings: string[] = [];

    // Use Mammoth Markdown conversion to preserve tables, list bullets, hyperlinks, and headings
    const mdResult = await (mammoth as any).convertToMarkdown({ buffer });
    let markdown = mdResult.value.trim();

    for (const msg of mdResult.messages) {
      warnings.push(msg.message);
    }

    // Normalize encoding artifacts
    markdown = this.normalizeEncodingArtifacts(markdown);

    // Normalize bullets
    markdown = this.normalizeBullets(markdown);

    const words = markdown.split(/\s+/).filter(Boolean);
    const estimatedPages = Math.max(1, Math.ceil(words.length / 350));

    // Split into simulated pages if markdown contains horizontal rules (page breaks) or by word estimate
    const rawPages = markdown.split(/\n\s*---\s*\n/);
    const pages: ExtractedPage[] = [];

    if (rawPages.length > 1) {
      rawPages.forEach((pText: string, idx: number) => {
        const trimmed = pText.trim();
        const pWords = trimmed.split(/\s+/).filter(Boolean);
        pages.push({
          pageNumber: idx + 1,
          text: trimmed,
          characterCount: trimmed.length,
          wordCount: pWords.length,
          hasColumns: false,
        });
      });
    } else {
      pages.push({
        pageNumber: 1,
        text: markdown,
        characterCount: markdown.length,
        wordCount: words.length,
        hasColumns: false,
      });
    }

    const structuredText = pages
      .map(
        (p) =>
          `<RESUME_PAGE_${p.pageNumber}>\n${p.text}\n</RESUME_PAGE_${p.pageNumber}>`,
      )
      .join("\n\n");

    return {
      fileType: "docx",
      pageCount: pages.length,
      actualPageCount: estimatedPages,
      pages,
      totalCharacters: markdown.length,
      totalWords: words.length,
      rawText: markdown,
      structuredText,
      warnings,
      isScannedOrImageOnly: false,
      metadata: {
        wordCount: words.length,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    };
  }

  /**
   * Groups coordinate-based text items into ordered lines.
   * Tolerates vertical jitter of ±3px.
   */
  private groupItemsIntoLines(
    items: Array<{ str: string; x: number; y: number }>,
  ): string[] {
    if (items.length === 0) return [];

    // Sort descending by Y (top of page has higher Y in PDF coordinates), then ascending by X
    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

    const lines: string[] = [];
    let currentLine: typeof items = [];
    let currentY: number | null = null;

    for (const item of sorted) {
      if (currentY === null || Math.abs(currentY - item.y) <= 3) {
        currentLine.push(item);
        if (currentY === null) currentY = item.y;
      } else {
        currentLine.sort((a, b) => a.x - b.x);
        lines.push(
          currentLine
            .map((i) => i.str)
            .join(" ")
            .trim(),
        );
        currentLine = [item];
        currentY = item.y;
      }
    }
    if (currentLine.length > 0) {
      currentLine.sort((a, b) => a.x - b.x);
      lines.push(
        currentLine
          .map((i) => i.str)
          .join(" ")
          .trim(),
      );
    }

    return lines.filter((l) => l.length > 0);
  }

  /**
   * Normalizes various bullet characters into standard bullet formatting.
   */
  private normalizeBullets(text: string): string {
    return text
      .split("\n")
      .map((line) => {
        // Match symbols: •, -, *, ▪, ◦, →, ‣, ¢, “, ƒ
        if (/^\s*[•▪◦→‣¢“ƒ]\s*/.test(line)) {
          return line.replace(/^\s*[•▪◦→‣¢“ƒ]\s*/, "• ");
        }
        return line;
      })
      .join("\n");
  }

  /**
   * Normalizes UTF-8 moji-bake encoding artifacts from PDF Type1 font streams.
   */
  private normalizeEncodingArtifacts(text: string): string {
    return text
      .replace(/\0/g, "")
      .replace(/[\u00e2\u00c2]\u0080\u0094|â€”/g, "—")
      .replace(/[\u00e2\u00c2]\u0080\u0093|â€“/g, "–")
      .replace(/[\u00e2\u00c2]\u0080\u00a2|â€¢/g, "•")
      .replace(/[\u00e2\u00c2]\u0080[\u0098\u0099]|â€˜|â€™/g, "'")
      .replace(/[\u00e2\u00c2]\u0080[\u009c\u009d]|â€œ|â€/g, '"');
  }
}

export const documentExtractionService = new DocumentExtractionService();
