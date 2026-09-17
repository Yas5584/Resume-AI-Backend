import {
  ResumeData,
  TemplateConfig,
  ResumeQualityFinding,
  ResumeQualityCategory,
  FindingSeverity,
} from "@resumeai/shared";
import { DeterministicCheckResult } from "../types.js";

const EMOJI_AND_DECORATIVE_REGEX =
  /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1D400}-\u{1D7FF}]/u;
const UNICODE_CONTROL_REGEX =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/;
const EXCESSIVE_PUNCTUATION_REGEX = /[!?]{2,}|\.{4,}/;

/**
 * Checks formatting, parseability risks, emoji/decorative symbols,
 * unicode control characters, and template density settings.
 */
export function checkFormattingAndParseability(
  data: ResumeData,
  config?: TemplateConfig | null,
): {
  result: DeterministicCheckResult;
  totalWords: number;
} {
  const findings: ResumeQualityFinding[] = [];
  let passed = 0;
  let total = 0;

  // 1. Check all text fields for Emojis / Decorative symbols
  total++;
  let foundEmoji = false;
  let foundControlChar = false;
  let foundExcessivePunct = false;
  let totalWords = 0;

  const inspectText = (text?: string | null, fieldName?: string) => {
    if (!text) return;
    const trimmed = text.trim();
    totalWords += trimmed.split(/\s+/).filter(Boolean).length;

    if (!foundEmoji && EMOJI_AND_DECORATIVE_REGEX.test(trimmed)) {
      foundEmoji = true;
      findings.push({
        id: "format-emoji-detected",
        category: ResumeQualityCategory.FORMATTING_PARSEABILITY,
        severity: FindingSeverity.MEDIUM,
        title: "Decorative emojis or symbols detected",
        description: `Found decorative unicode symbols or emojis in "${fieldName || "resume text"}".`,
        whyItMatters:
          "Potential parsing risk: Many ATS parsers replace emojis with garbled replacement characters (e.g.  or ??), corrupting adjacent words.",
        recommendation: "Replace emojis with standard text or standard bullet characters.",
        evidence: trimmed.slice(0, 60),
      });
    }

    if (!foundControlChar && UNICODE_CONTROL_REGEX.test(trimmed)) {
      foundControlChar = true;
      findings.push({
        id: "format-control-char",
        category: ResumeQualityCategory.FORMATTING_PARSEABILITY,
        severity: FindingSeverity.HIGH,
        title: "Hidden Unicode control characters found",
        description: "Contains zero-width spaces or non-standard control characters.",
        whyItMatters: "Potential parsing risk: Invisible characters can break keyword tokenization in older ATS engines.",
        recommendation: "Re-type the affected text directly or paste as plain text.",
      });
    }

    if (!foundExcessivePunct && EXCESSIVE_PUNCTUATION_REGEX.test(trimmed)) {
      foundExcessivePunct = true;
      findings.push({
        id: "format-excessive-punctuation",
        category: ResumeQualityCategory.FORMATTING_PARSEABILITY,
        severity: FindingSeverity.LOW,
        title: "Repeated punctuation marks",
        description: "Found repeated exclamation marks or excessive question marks/dots.",
        whyItMatters: "Unprofessional punctuation can trigger formatting flags in corporate review filters.",
        recommendation: "Use standard single punctuation marks at the end of statements.",
        evidence: trimmed.slice(0, 60),
      });
    }
  };

  // Inspect all text properties
  inspectText(data.personalInfo?.fullName, "Full Name");
  inspectText(data.personalInfo?.headline, "Headline");
  inspectText(data.summary, "Summary");
  (data.experience || []).forEach((exp) => {
    inspectText(exp.jobTitle, "Job Title");
    inspectText(exp.company, "Company");
    (exp.bullets || []).forEach((b) => inspectText(b, "Experience Bullet"));
  });
  (data.projects || []).forEach((proj) => {
    inspectText(proj.name, "Project Name");
    inspectText(proj.description, "Project Description");
    (proj.bullets || []).forEach((b) => inspectText(b, "Project Bullet"));
  });

  if (!foundEmoji && !foundControlChar && !foundExcessivePunct) {
    passed++;
  }

  // 2. Template Configuration Analysis
  total++;
  let templateConfigPassed = true;
  if (config) {
    if (config.fontSize === "sm") {
      templateConfigPassed = false;
      findings.push({
        id: "format-small-font",
        category: ResumeQualityCategory.FORMATTING_PARSEABILITY,
        severity: FindingSeverity.LOW,
        title: "Compact font size selected",
        description: "The template font size is currently set to 'Small' (~9-10pt).",
        whyItMatters:
          "Very small font sizes can challenge readability for human recruiters reviewing printed copies.",
        recommendation:
          "Consider using 'Medium' font size unless tightly constrained by page boundaries.",
      });
    }

    if (config.margins === "compact") {
      findings.push({
        id: "format-tight-margins",
        category: ResumeQualityCategory.FORMATTING_PARSEABILITY,
        severity: FindingSeverity.INFO,
        title: "Tight margins enabled",
        description: "Compact margins provide maximum content area but reduce whitespace.",
        whyItMatters:
          "Standard margins (0.5 to 0.75 inches) ensure comfortable framing across digital readers and PDF print preview.",
        recommendation:
          "Check the live preview to verify that text does not appear cramped against page edges.",
      });
    }
  }
  if (templateConfigPassed) passed++;

  // 3. Word Count & Document Density Check
  total++;
  if (totalWords > 1300) {
    findings.push({
      id: "format-high-word-count",
      category: ResumeQualityCategory.FORMATTING_PARSEABILITY,
      severity: FindingSeverity.LOW,
      title: `High word density (${totalWords} words)`,
      description: "Total resume word count exceeds typical length recommendations (typically 400-900 words).",
      whyItMatters:
        "Excessive density can cause resume text to spill awkwardly onto additional pages or cause recruiter fatigue.",
      recommendation:
        "Review bullet points and trim older or less relevant responsibilities.",
    });
  } else if (totalWords < 120 && totalWords > 0) {
    findings.push({
      id: "format-sparse-content",
      category: ResumeQualityCategory.FORMATTING_PARSEABILITY,
      severity: FindingSeverity.MEDIUM,
      title: `Sparse content (${totalWords} words)`,
      description: "The resume contains very brief content overall.",
      whyItMatters:
        "Insufficient content leaves significant blank space and provides fewer keywords for ATS evaluation.",
      recommendation: "Expand on your project deliverables and key job responsibilities.",
    });
  } else {
    passed++;
  }

  return {
    result: {
      category: ResumeQualityCategory.FORMATTING_PARSEABILITY,
      findings,
      passedChecksCount: passed,
      totalChecksCount: total,
      metrics: {
        totalWords,
        foundEmoji,
        foundControlChar,
      },
    },
    totalWords,
  };
}
