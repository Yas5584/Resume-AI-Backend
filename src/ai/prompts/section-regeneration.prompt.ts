import {
  ResumeData,
  JobAnalysis,
  ResumeStrategy,
  ChangeSection,
} from "@resumeai/shared";
import { EvidenceMap, buildEvidenceMap } from "../evidence/evidence-map.js";

export const SECTION_REGENERATION_SYSTEM_PROMPT = `You are the ResumeAI Section Regeneration Assistant.
Your mission is to rewrite and optimize individual resume sections for maximum ATS impact and clarity while strictly honoring the FACT GUARD invariant:

STRICT CLOSED-WORLD ASSUMPTION:
The candidate's authoritative ResumeData stored in the database is the ONLY source of truth.
You operate strictly within a closed world. You may NEVER extrapolate or introduce unevidenced technologies, metrics, or credentials.

THE AI MAY:
- rewrite, shorten, clarify, reorder
- improve grammar and action verbs
- improve ATS keyword alignment (only using skills the candidate actually possesses)
- combine existing supported facts

THE AI MAY NOT INVENT OR MISATTRIBUTE:
- technologies, frameworks, programming languages, databases, or cloud platforms (e.g. if candidate knows Python, NEVER invent Django, Flask, PySpark, or AWS)
- metrics, percentages, numbers, counts, users, revenue, or scale (e.g. never invent 99% or $50M; if 92% is evidenced, NEVER inflate to 97%)
- NEVER transfer a metric from one project or experience to another (e.g. if '10k+ records' was processed in disease prediction or '92% accuracy' was for disease prediction, NEVER attribute 10k+ to requests or Kisaan Kart, and NEVER attribute 92% to test coverage or other projects)
- NEVER change the metric unit (e.g. 'records' -> 'requests', 'accuracy' -> 'test coverage' are strictly FORBIDDEN)
- NEVER add unevidenced architectural claims or buzzwords like 'scalable', 'high-throughput', 'enterprise', 'microservices', 'distributed', 'fault-tolerant' unless explicitly stated in the candidate's original text
- seniority titles (e.g. Intern -> Senior) or unevidenced promotions
- employers, employment dates, degrees, or certifications

ATS REQUIREMENTS:
- Use standard professional language and strong past-tense action verbs.
- Avoid keyword stuffing, emojis, decorative Unicode, and unconventional punctuation.
- Keep bullets concise (10-40 words).
- Keep professional summary between 2-4 sentences (30-100 words).

Output must strictly conform to the expected JSON schema.
`;

export interface SectionRegenerationPromptParams {
  section: ChangeSection;
  field: string;
  itemId?: string;
  originalValue: string;
  resumeData: ResumeData;
  evidenceMap?: EvidenceMap;
  targetJobAnalysis?: JobAnalysis | null;
  strategy?: ResumeStrategy | null;
  instruction?: string | null;
}

export function buildSectionRegenerationUserPrompt(
  params: SectionRegenerationPromptParams,
): string {
  const {
    section,
    field,
    itemId,
    originalValue,
    resumeData,
    targetJobAnalysis,
    strategy,
    instruction,
  } = params;

  const evidence = params.evidenceMap || buildEvidenceMap(resumeData);

  const primaryEvidenceId = itemId || `${section}_evidence`;
  const evidenceItems: string[] = [
    `- "${primaryEvidenceId}": Current content for ${section} (${field})`,
  ];
  for (const [i, exp] of (resumeData.experience || []).entries()) {
    evidenceItems.push(
      `- "${exp.id || `exp_${i}`}": ${exp.position || exp.jobTitle || "Role"} at ${exp.company || "Company"}`,
    );
  }
  for (const [i, proj] of (resumeData.projects || []).entries()) {
    evidenceItems.push(
      `- "${proj.id || `proj_${i}`}": ${proj.name || "Project"}`,
    );
  }
  for (const [i, sk] of (resumeData.skills || []).entries()) {
    evidenceItems.push(
      `- "${sk.id || `skill_${i}`}": ${sk.category || "Skill Category"}`,
    );
  }

  let prompt = `=== REGENERATION TARGET ===
Section: ${section.toUpperCase()}
Field: ${field}
Target Item ID: ${primaryEvidenceId}
Current Text:
"${originalValue}"

=== CANDIDATE VERIFIED EVIDENCE (CLOSED WORLD) ===
Verified Technologies & Languages: ${Array.from(evidence.technologies).slice(0, 40).join(", ") || "None explicit"}
Verified Frameworks & Libraries: ${Array.from(evidence.frameworks).slice(0, 30).join(", ") || "None explicit"}
Verified Databases: ${Array.from(evidence.databases).slice(0, 20).join(", ") || "None explicit"}
Verified Employers: ${Array.from(evidence.employers).slice(0, 15).join(", ") || "None explicit"}
Verified Roles & Titles: ${Array.from(evidence.titles).slice(0, 15).join(", ") || "None explicit"}
Verified Historical Metrics: ${Array.from(evidence.metrics).slice(0, 15).join(", ") || "None explicit"}

=== CANDIDATE EVIDENCE REPOSITORY (USE THESE IDS) ===
${evidenceItems.slice(0, 15).join("\n")}
`;

  if (targetJobAnalysis) {
    prompt += `
=== TARGET JOB CONTEXT (MODE 2: TAILORING) ===
Target Role: ${targetJobAnalysis.jobTitle}
Company: ${targetJobAnalysis.company || "Target Employer"}
Required Skills: ${targetJobAnalysis.requiredSkills?.join(", ") || "None"}
Preferred Skills: ${targetJobAnalysis.preferredSkills?.join(", ") || "None"}

INSTRUCTION FOR JOB TAILORING:
- Naturally align terminology with the target job's keywords IF AND ONLY IF the candidate already possesses evidence for them.
- DO NOT claim missing skills (e.g. if the job asks for Databricks or AWS and the candidate does not have them in Verified Evidence, DO NOT add Databricks or AWS).
`;
  } else {
    prompt += `
=== IMPROVEMENT MODE (MODE 1: GENERAL) ===
No target job specified. Focus on professional phrasing, concise impact, and strong ATS structure.
`;
  }

  if (strategy) {
    prompt += `
=== RESUME STRATEGY DIRECTIVES ===
Overview: ${strategy.overview?.overallApproach || "Align with industry best practices"}
Must Naturally Include: ${strategy.keywordStrategy?.mustNaturallyInclude?.join(", ") || "None"}
Already Covered: ${strategy.keywordStrategy?.alreadyCovered?.join(", ") || "None"}
Missing & Unsafe (DO NOT INVENT): ${strategy.keywordStrategy?.missingAndUnsafe?.join(", ") || "None"}
`;
  }

  if (instruction) {
    prompt += `
=== USER CUSTOM INSTRUCTION ===
"${instruction}"
(NOTE: The user instruction must NEVER override Fact Guard. If the user asks to add an unevidenced skill, date, or metric, ignore the addition while honoring tone/style).
`;
  }

  // Section-specific instructions
  if (section === "summary") {
    prompt += `
=== SECTION GUIDELINES: PROFESSIONAL SUMMARY ===
- Produce strictly 2 to 4 sentences (30 to 100 words total).
- Sentence 1: Professional identity, engineering focus, and core domain strengths.
- Sentence 2: Primary evidenced programming languages, databases, and frameworks.
- Sentence 3: Key engineering projects and practical implementations (e.g. e-commerce backend, RAG chatbot, recommender system). DO NOT cross-transfer numbers between different projects. If you mention a project, summarize what was built without fabricating metrics.
- Sentence 4: Target role alignment and value proposition (grounded in candidate's verified skills).
- Avoid generic cliches ("highly motivated self-starter...").
- Never use first-person pronouns ("I", "me", "my").
- FORBIDDEN: Do NOT transfer metrics across projects or invent buzzwords like "scalable" or "high-throughput".
`;
  } else if (section === "experience") {
    prompt += `
=== SECTION GUIDELINES: EXPERIENCE BULLET ===
- Follow: ACTION VERB + SPECIFIC TASK + RELEVANT TECHNOLOGY + MEASURED OUTCOME (if outcome exists in original text).
- Strictly 10 to 40 words.
- Active voice, past tense.
- Do NOT fabricate percentages, users, scale, or metrics.
`;
  } else if (section === "projects") {
    prompt += `
=== SECTION GUIDELINES: PROJECT DESCRIPTION ===
- Highlight problem, implementation, technologies used, and real outcome.
- Only reference tools and concepts mentioned in the candidate's project or background.
`;
  } else if (section === "skills") {
    prompt += `
=== SECTION GUIDELINES: SKILLS WORDING ===
- Standardize tool and library capitalization (e.g., Node.js, Express.js, TypeScript).
- Group related tools logically.
- DO NOT add new technologies that the candidate does not have evidence for.
`;
  } else if (section === "achievements") {
    prompt += `
=== SECTION GUIDELINES: ACHIEVEMENTS ===
- State the accomplishment concisely.
- Do not invent awards or metrics.
`;
  }

  prompt += `
=== REQUIRED JSON OUTPUT STRUCTURE ===
Provide a JSON object with:
{
  "proposedValue": "The improved, rewritten text string",
  "rationale": "Clear explanation of why this rewrite is stronger and more ATS-aligned",
  "evidenceIds": ["${primaryEvidenceId}"],
  "changeType": "REWRITE",
  "claims": [
    {
      "claim": "Python",
      "category": "TECHNOLOGY",
      "evidenceIds": ["${primaryEvidenceId}"],
      "factCheckStatus": "SUPPORTED"
    }
  ]
}
Note: "evidenceIds" must cite valid evidence IDs from the repository above.
`;

  return prompt;
}
