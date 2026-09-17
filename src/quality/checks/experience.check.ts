import {
  ResumeData,
  WorkExperience,
  ResumeQualityFinding,
  ResumeQualityCategory,
  FindingSeverity,
} from "@resumeai/shared";
import { STRONG_ACTION_VERBS } from "../../ai/ats-validator/ats-validator.js";
import { DeterministicCheckResult } from "../types.js";

// 1. True passive voice patterns (form of "to be" + past participle, or past participle + "by")
// "was tasked with", "were developed by", "was assigned to", "is built by", etc.
const PASSIVE_VOICE_REGEX =
  /\b(?:was|were|is|are|been|being)\s+(?:tasked|assigned|asked|required|built|developed|managed|engineered|given|chosen|directed|selected|deployed|created)\b/i;
const PASSIVE_BY_REGEX =
  /\b(?:developed|created|managed|maintained|led|directed|engineered|built|implemented)\s+by\b/i;

// 2. Maintained list of weak/general action verbs (WEAK_ACTION_VERB)
// "worked on", "helped with", "assisted with", "participated in", "involved in", "was involved in", "explored", "explored data", "handled", "dealt with", "contributed to"
const WEAK_ACTION_VERB_PHRASES = [
  "worked on",
  "helped with",
  "assisted with",
  "participated in",
  "involved in",
  "was involved in",
  "explored data",
  "explored",
  "dealt with",
  "handled",
  "contributed to",
];

// 3. Vague / responsibility-oriented wording (VAGUE_WORDING)
const VAGUE_WORDING_PHRASES = [
  "responsible for",
  "duties included",
  "tasked with",
  "familiar with",
  "various tasks",
  "etc.",
  "and more",
];

// Metric patterns (e.g. 20%, $5M, 150k, 10x, 45+, reduced by 30)
const METRIC_REGEX = /\b(?:\d+[%kKmMbB]?|\$\d+(?:\.\d+)?(?:[kKmMbB])?|\d+x|\d+\+)\b/;

/**
 * Evaluates work experience entries, action verbs, bullet clarity, metrics, and technologies.
 */
export function checkExperienceAndContent(
  data: ResumeData,
): {
  experienceResult: DeterministicCheckResult;
  contentResult: DeterministicCheckResult;
  metrics: {
    experienceCount: number;
    bulletCount: number;
    quantifiedBulletsCount: number;
    actionVerbBulletsCount: number;
  };
} {
  const expFindings: ResumeQualityFinding[] = [];
  const contentFindings: ResumeQualityFinding[] = [];

  const experiences: WorkExperience[] = data.experience || [];
  let expPassed = 0;
  let expTotal = 0;
  let contentPassed = 0;
  let contentTotal = 0;

  let totalBullets = 0;
  let quantifiedBullets = 0;
  let actionVerbBullets = 0;

  // If zero experience entries
  if (experiences.length === 0) {
    return {
      experienceResult: {
        category: ResumeQualityCategory.EXPERIENCE_QUALITY,
        findings: [
          {
            id: "exp-none",
            category: ResumeQualityCategory.EXPERIENCE_QUALITY,
            severity: FindingSeverity.CRITICAL,
            title: "No work experience entries",
            description: "No work experience history was provided in the resume.",
            whyItMatters: "Experience is the primary evaluation criteria for professional roles.",
            recommendation:
              "Add your past employment, internships, or relevant contract work.",
            section: "experience",
          },
        ],
        passedChecksCount: 0,
        totalChecksCount: 5,
        metrics: { experienceCount: 0, bulletCount: 0 },
      },
      contentResult: {
        category: ResumeQualityCategory.CONTENT_QUALITY,
        findings: [
          {
            id: "content-no-bullets",
            category: ResumeQualityCategory.CONTENT_QUALITY,
            severity: FindingSeverity.HIGH,
            title: "No experience bullets to evaluate",
            description: "Experience content is empty.",
            whyItMatters: "Recruiters evaluate competency through bulleted accomplishment statements.",
            recommendation: "Add descriptive bullet points detailing your responsibilities and results.",
            section: "experience",
          },
        ],
        passedChecksCount: 0,
        totalChecksCount: 5,
        metrics: { bulletCount: 0 },
      },
      metrics: {
        experienceCount: 0,
        bulletCount: 0,
        quantifiedBulletsCount: 0,
        actionVerbBulletsCount: 0,
      },
    };
  }

  // 1. Role Completeness (Titles, Companies, Dates)
  expTotal++;
  let rolesComplete = true;
  experiences.forEach((exp, idx) => {
    if (!exp.jobTitle || !exp.jobTitle.trim()) {
      rolesComplete = false;
      expFindings.push({
        id: `exp-missing-title-${exp.id || idx}`,
        category: ResumeQualityCategory.EXPERIENCE_QUALITY,
        severity: FindingSeverity.HIGH,
        title: `Missing job title at ${exp.company || `Role #${idx + 1}`}`,
        description: "A clear job title is missing from this position.",
        whyItMatters: "ATS parsers index titles to match candidate seniority and role specialization.",
        recommendation: "Provide a standard industry title (e.g. Senior Software Engineer).",
        section: "experience",
        itemId: exp.id,
        field: "jobTitle",
      });
    }

    if (!exp.company || !exp.company.trim()) {
      rolesComplete = false;
      expFindings.push({
        id: `exp-missing-company-${exp.id || idx}`,
        category: ResumeQualityCategory.EXPERIENCE_QUALITY,
        severity: FindingSeverity.HIGH,
        title: `Missing employer name for ${exp.jobTitle || `Role #${idx + 1}`}`,
        description: "Company or organization name is not specified.",
        whyItMatters: "Work history verification requires identifiable employer names.",
        recommendation: "Specify the company or organization name.",
        section: "experience",
        itemId: exp.id,
        field: "company",
      });
    }

    if (!exp.startDate || !exp.startDate.trim()) {
      rolesComplete = false;
      expFindings.push({
        id: `exp-missing-startdate-${exp.id || idx}`,
        category: ResumeQualityCategory.EXPERIENCE_QUALITY,
        severity: FindingSeverity.MEDIUM,
        title: `Missing start date for ${exp.jobTitle || `Role #${idx + 1}`}`,
        description: "No start date provided for this role.",
        whyItMatters: "Without start dates, ATS systems cannot calculate total years of experience.",
        recommendation: "Add the month and year you commenced this position (e.g. Jan 2022).",
        section: "experience",
        itemId: exp.id,
        field: "startDate",
      });
    }
  });

  if (rolesComplete) expPassed++;

  // 2. Bullet Point Counts per Role (Best practice: 2-6 bullets per role)
  expTotal++;
  let balancedBullets = true;
  experiences.forEach((exp, idx) => {
    const bCount = (exp.bullets || []).filter((b) => b.trim().length > 0).length;
    if (bCount === 0) {
      balancedBullets = false;
      expFindings.push({
        id: `exp-no-bullets-${exp.id || idx}`,
        category: ResumeQualityCategory.EXPERIENCE_QUALITY,
        severity: FindingSeverity.HIGH,
        title: `No accomplishment bullets for ${exp.jobTitle || exp.company}`,
        description: "This role contains no descriptive bullet points.",
        whyItMatters: "Titles alone do not demonstrate what you achieved or how you worked.",
        recommendation: "Add 2-5 bullet points outlining key deliverables and tools used.",
        section: "experience",
        itemId: exp.id,
        field: "bullets",
      });
    } else if (bCount > 8) {
      balancedBullets = false;
      expFindings.push({
        id: `exp-too-many-bullets-${exp.id || idx}`,
        category: ResumeQualityCategory.EXPERIENCE_QUALITY,
        severity: FindingSeverity.LOW,
        title: `High bullet density (${bCount} bullets) for ${exp.jobTitle}`,
        description: "Having more than 7-8 bullets for a single position dilutes reader focus.",
        whyItMatters: "Recruiters skim resumes in 6-8 seconds; concise bullet lists are read more effectively.",
        recommendation: "Condense into the top 4-5 highest-impact achievements.",
        section: "experience",
        itemId: exp.id,
      });
    }
  });
  if (balancedBullets) expPassed++;

  // 3. Action Verbs, Passive Voice, Weak Phrases, and Vague Wording
  contentTotal++;
  let problematicBulletsCount = 0;

  experiences.forEach((exp) => {
    const bullets = exp.bullets || [];
    bullets.forEach((bullet, bIdx) => {
      const trimmed = bullet.trim();
      if (!trimmed) return;
      totalBullets++;

      const words = trimmed.split(/\s+/);
      const firstWord = words[0]?.toLowerCase().replace(/[^a-z]/g, "");

      if (STRONG_ACTION_VERBS.has(firstWord)) {
        actionVerbBullets++;
      }

      const lower = trimmed.toLowerCase();

      // A. Check True Passive Voice
      const passiveMatch = trimmed.match(PASSIVE_VOICE_REGEX) || trimmed.match(PASSIVE_BY_REGEX);
      if (passiveMatch) {
        problematicBulletsCount++;
        const matched = passiveMatch[0];
        contentFindings.push({
          id: `content-passive-voice-${exp.id}-${bIdx}`,
          category: ResumeQualityCategory.CONTENT_QUALITY,
          severity: FindingSeverity.MEDIUM,
          classification: "PASSIVE_VOICE",
          title: `Passive voice detected ("${matched}")`,
          description: `Bullet uses passive phrasing: "...${matched}...". Active voice conveys clearer ownership.`,
          whyItMatters: "Active statements ('Built...', 'Led...') present your contributions with stronger ownership and authority.",
          recommendation: `If supported by your experience, consider rephrasing into active voice (e.g. "Engineered..." or "Directed..." instead of "${matched}").`,
          section: "experience",
          itemId: exp.id,
          field: `bullets[${bIdx}]`,
          evidence: trimmed.slice(0, 80),
        });
        return; // Avoid double-flagging same bullet
      }

      // B. Check Weak Action Verb / Starter Phrases
      // E.g. "Worked on", "Helped with", "Explored data", "Explored"
      let matchedWeakVerb: string | null = null;
      for (const phrase of WEAK_ACTION_VERB_PHRASES) {
        // Match phrase at start of bullet or as prominent clause
        const phraseRegex = new RegExp(`(^|\\b)${phrase}\\b`, "i");
        if (phraseRegex.test(lower)) {
          matchedWeakVerb = phrase;
          break;
        }
      }

      if (matchedWeakVerb) {
        problematicBulletsCount++;
        contentFindings.push({
          id: `content-weak-action-verb-${exp.id}-${bIdx}`,
          category: ResumeQualityCategory.CONTENT_QUALITY,
          severity: FindingSeverity.MEDIUM,
          classification: "WEAK_ACTION_VERB",
          title: `Weak action verb detected ("${matchedWeakVerb}")`,
          description: `Bullet starts with or relies on weak action verb "${matchedWeakVerb}".`,
          whyItMatters: "Decisive action verbs immediately convey technical ownership and capability.",
          recommendation: `If supported by your experience, consider replacing "${matchedWeakVerb}" with a strong action verb such as "Built", "Developed", "Engineered", "Optimized", or "Implemented".`,
          section: "experience",
          itemId: exp.id,
          field: `bullets[${bIdx}]`,
          evidence: trimmed.slice(0, 80),
        });
        return;
      }

      // C. Check Vague / Duty-oriented Phrases
      let matchedVague: string | null = null;
      for (const phrase of VAGUE_WORDING_PHRASES) {
        if (lower.includes(phrase)) {
          matchedVague = phrase;
          break;
        }
      }

      if (matchedVague) {
        problematicBulletsCount++;
        contentFindings.push({
          id: `content-vague-wording-${exp.id}-${bIdx}`,
          category: ResumeQualityCategory.CONTENT_QUALITY,
          severity: FindingSeverity.MEDIUM,
          classification: "VAGUE_WORDING",
          title: `Vague or responsibility-oriented wording ("${matchedVague}")`,
          description: `Bullet contains passive duty-oriented phrasing: "...${matchedVague}...".`,
          whyItMatters: "Listing duties sounds like a job description rather than demonstrating what you personally delivered.",
          recommendation: "If supported by your experience, rephrase to highlight what you executed or delivered rather than general responsibilities.",
          section: "experience",
          itemId: exp.id,
          field: `bullets[${bIdx}]`,
          evidence: trimmed.slice(0, 80),
        });
        return;
      }

      // Check measurable impact
      if (METRIC_REGEX.test(trimmed)) {
        quantifiedBullets++;
      }

      // Length checks
      if (words.length < 4) {
        contentFindings.push({
          id: `content-short-bullet-${exp.id}-${bIdx}`,
          category: ResumeQualityCategory.CONTENT_QUALITY,
          severity: FindingSeverity.LOW,
          classification: "LOW_SPECIFICITY",
          title: "Bullet is unusually short",
          description: `Bullet only contains ${words.length} words.`,
          whyItMatters: "Very short bullets often lack necessary context on technical scope.",
          recommendation: "If supported by your experience, provide additional context on the problem, tools used, and result.",
          section: "experience",
          itemId: exp.id,
          field: `bullets[${bIdx}]`,
          evidence: trimmed,
        });
      } else if (words.length > 55) {
        contentFindings.push({
          id: `content-runon-bullet-${exp.id}-${bIdx}`,
          category: ResumeQualityCategory.CONTENT_QUALITY,
          severity: FindingSeverity.LOW,
          title: "Bullet point is a run-on sentence",
          description: `Bullet contains ${words.length} words without sentence breaks.`,
          whyItMatters: "Long run-on bullets reduce scannability and impact.",
          recommendation: "Consider splitting into two punchier bullets or condensing to essential impact.",
          section: "experience",
          itemId: exp.id,
          field: `bullets[${bIdx}]`,
          evidence: trimmed.slice(0, 80) + "...",
        });
      }
    });
  });

  if (problematicBulletsCount === 0) contentPassed++;
  if (totalBullets > 0 && actionVerbBullets / totalBullets >= 0.5) {
    contentPassed++;
  } else if (totalBullets > 2 && actionVerbBullets / totalBullets < 0.4) {
    // Only flag low action verb density if significantly below threshold across whole resume
    contentFindings.push({
      id: "content-low-action-verbs",
      category: ResumeQualityCategory.CONTENT_QUALITY,
      severity: FindingSeverity.LOW,
      classification: "WEAK_ACTION_VERB",
      title: "Opportunity to increase action-oriented bullet openings",
      description: `Only ${actionVerbBullets} of ${totalBullets} bullets begin with recognized strong action verbs.`,
      whyItMatters: "Opening accomplishment bullets with strong action verbs increases reader engagement and ATS impact.",
      recommendation: "Where applicable, start bullets with strong action verbs (e.g. 'Engineered', 'Optimized', 'Architected').",
      section: "experience",
    });
  } else {
    contentPassed++;
  }

  // 4. Measurable Outcomes Check (Fact Guard: do not require metric on every bullet)
  contentTotal++;
  const hasSomeMetrics = quantifiedBullets > 0;
  if (hasSomeMetrics) {
    contentPassed++;
  } else if (totalBullets > 3) {
    contentFindings.push({
      id: "content-no-quantified-metrics",
      category: ResumeQualityCategory.CONTENT_QUALITY,
      severity: FindingSeverity.MEDIUM,
      title: "Limited measurable outcomes or metrics",
      description: "None of the work experience bullets contain quantified outcomes (e.g. percentages, latency, volume).",
      whyItMatters:
        "Where supported by your actual experience, metrics (such as performance gains or user scale) significantly strengthen credibility.",
      recommendation:
        "If you have measurable results supported by your experience, consider including percentages, numbers, or time savings.",
      section: "experience",
    });
  } else {
    contentPassed++;
  }

  // 5. Technologies mentioned in Experience
  expTotal++;
  let hasTechnologiesMentioned = false;
  experiences.forEach((exp) => {
    if (exp.technologiesUsed && exp.technologiesUsed.length > 0) {
      hasTechnologiesMentioned = true;
    }
  });

  if (hasTechnologiesMentioned) {
    expPassed++;
  } else {
    expFindings.push({
      id: "exp-no-tech-tags",
      category: ResumeQualityCategory.EXPERIENCE_QUALITY,
      severity: FindingSeverity.INFO,
      title: "No specific technologies tagged per role",
      description: "Listing key tools and frameworks per position provides rapid ATS indexing.",
      whyItMatters: "ATS parsers link skills to specific timeframes and roles to verify seniority in that skill.",
      recommendation: "If applicable, explicitly list the primary technologies and tools used under each role.",
      section: "experience",
    });
  }

  return {
    experienceResult: {
      category: ResumeQualityCategory.EXPERIENCE_QUALITY,
      findings: expFindings.slice(0, 10),
      passedChecksCount: expPassed,
      totalChecksCount: expTotal,
      metrics: {
        experienceCount: experiences.length,
        balancedBullets,
        hasTechnologiesMentioned,
      },
    },
    contentResult: {
      category: ResumeQualityCategory.CONTENT_QUALITY,
      findings: contentFindings.slice(0, 10),
      passedChecksCount: contentPassed,
      totalChecksCount: contentTotal,
      metrics: {
        totalBullets,
        quantifiedBullets,
        actionVerbBullets,
        problematicBulletsCount,
      },
    },
    metrics: {
      experienceCount: experiences.length,
      bulletCount: totalBullets,
      quantifiedBulletsCount: quantifiedBullets,
      actionVerbBulletsCount: actionVerbBullets,
    },
  };
}
