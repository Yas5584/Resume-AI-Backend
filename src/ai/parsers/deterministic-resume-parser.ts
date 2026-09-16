import { ResumeParseResult, ResumeParseResultSchema } from "@resumeai/shared";

/**
 * Deterministic Resume Parser
 *
 * Extracts structured ResumeData from raw or structured text when running in mock AI mode
 * or as a robust fallback if LLM extraction fails or is unavailable.
 *
 * Key features:
 * - Flexible heading and block layout parsing (no pipe requirement)
 * - Multi-line layout support for experience, projects, and education
 * - Full extraction of certifications, achievements, languages, and links
 * - Bullet preservation (•, -, *, ▪, ◦, →, ‣, numbered)
 * - Markdown table handling
 * - Prompt injection resilience (treats adversarial instructions as text)
 */
export function parseResumeFromText(rawText: string): ResumeParseResult {
  const safeText = rawText || "";
  // Strip page tags for line splitting while preserving content
  let cleanedText = safeText.replace(/<\/?RESUME_PAGE_\d+>/gi, "");
  // Unescape markdown backslash escapes from mammoth/docx: \., \-, \*, \[, \], \(, \), \_
  cleanedText = cleanedText.replace(/\\([.\-*_\[\]\(\)\\])/g, "$1");
  // Normalize UTF-8 moji-bake encoding artifacts from raw PDF Type1 font streams
  cleanedText = cleanedText
    .replace(/[\u00e2\u00c2]\u0080\u0094|â€”/g, "—")
    .replace(/[\u00e2\u00c2]\u0080\u0093|â€“/g, "–")
    .replace(/[\u00e2\u00c2]\u0080\u00a2|â€¢/g, "•")
    .replace(/[\u00e2\u00c2]\u0080[\u0098\u0099]|â€˜|â€™/g, "'")
    .replace(/[\u00e2\u00c2]\u0080[\u009c\u009d]|â€œ|â€/g, '"');

  const lines = cleanedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith("-- ") && !l.endsWith(" --"));

  let fullName = "";
  let headline = "";
  let email = "";
  let phone = "";
  let location = "";
  let github = "";
  let githubUrl = "";
  let linkedin = "";
  let linkedinUrl = "";
  let website = "";

  // 1. Email regex
  const emailMatch = cleanedText.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  );
  if (emailMatch) email = emailMatch[0];

  // 2. Phone regex (international & domestic)
  const phoneMatch = cleanedText.match(
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/,
  );
  if (phoneMatch && phoneMatch[0].length >= 10) phone = phoneMatch[0];

  // 3. GitHub regex & markdown link
  const rawGhMatch = cleanedText.match(
    /https?:\/\/github\.com\/([a-zA-Z0-9_-]+)/i,
  );
  if (rawGhMatch) {
    githubUrl = rawGhMatch[0];
    github = githubUrl;
  } else {
    const mdGhMatch = cleanedText.match(
      /\\?\[([^\]]*GitHub[^\]]*)\\?\]\((https?:\/\/github\.com\/[^\)]+)\)/i,
    );
    if (mdGhMatch) {
      githubUrl = mdGhMatch[2];
      github = githubUrl;
    } else {
      const ghMatch =
        cleanedText.match(/github\.com\/([a-zA-Z0-9_-]+)/i) ||
        cleanedText.match(/github:\s*([a-zA-Z0-9_-]+)/i);
      if (ghMatch) {
        const url = ghMatch[1].startsWith("http")
          ? ghMatch[1]
          : `https://github.com/${ghMatch[1]}`;
        github = url;
        githubUrl = url;
      }
    }
  }

  // 4. LinkedIn regex & markdown link
  const rawLiMatch = cleanedText.match(
    /https?:\/\/(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i,
  );
  if (rawLiMatch) {
    linkedinUrl = rawLiMatch[0];
    linkedin = linkedinUrl;
  } else {
    const mdLiMatch = cleanedText.match(
      /\\?\[([^\]]*LinkedIn[^\]]*)\\?\]\((https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\)]+)\)/i,
    );
    if (mdLiMatch) {
      linkedinUrl = mdLiMatch[2];
      linkedin = linkedinUrl;
    } else {
      const liMatch =
        cleanedText.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i) ||
        cleanedText.match(/linkedin:\s*([a-zA-Z0-9_-]+)/i);
      if (liMatch) {
        const url = liMatch[1].startsWith("http")
          ? liMatch[1]
          : `https://linkedin.com/in/${liMatch[1]}`;
        linkedin = url;
        linkedinUrl = url;
      }
    }
  }

  // 5. General portfolio / website
  const mdWebMatch = cleanedText.match(
    /\\?\[([^\]]*(?:Portfolio|Website)[^\]]*)\\?\]\((https?:\/\/[^\)]+)\)/i,
  );
  if (mdWebMatch) {
    website = mdWebMatch[2];
  } else {
    const webMatch = cleanedText.match(
      /https?:\/\/(?!(?:www\.)?(?:github\.com|linkedin\.com))[a-zA-Z0-9.\-_~:\/?#[\]@!$&'()*+,;=]+/i,
    );
    if (webMatch) {
      website = webMatch[0];
    }
  }

  // Identify section headers
  const SECTION_PATTERNS: Record<string, RegExp> = {
    summary:
      /^(PROFESSIONAL SUMMARY|SUMMARY|PROFILE|ABOUT ME|OBJECTIVE|EXECUTIVE SUMMARY)/i,
    skills:
      /^(TECHNICAL SKILLS|SKILLS|CORE COMPETENCIES|AREAS OF EXPERTISE|TECHNOLOGIES|KEY SKILLS|TOOLBOX)/i,
    experience:
      /^(PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EXPERIENCE|EMPLOYMENT HISTORY|WORK HISTORY)/i,
    projects:
      /^(KEY PROJECTS|PROJECTS|PERSONAL PROJECTS|ACADEMIC PROJECTS|NOTABLE PROJECTS)/i,
    education:
      /^(EDUCATION|ACADEMIC BACKGROUND|ACADEMICS|ACADEMIC QUALIFICATIONS)/i,
    certifications:
      /^(CERTIFICATIONS|CERTIFICATES|LICENSES|LICENSES & CERTIFICATIONS)/i,
    achievements:
      /^(ACHIEVEMENTS|HONORS & AWARDS|AWARDS|HONORS|ACCOMPLISHMENTS)/i,
    languages: /^(LANGUAGES|LANGUAGE PROFICIENCY)/i,
    links: /^(LINKS|ONLINE PROFILES|PORTFOLIO & LINKS)/i,
  };

  const sections: { key: string; lineIdx: number; title: string }[] = [];
  lines.forEach((line, idx) => {
    // Check if line is a markdown heading or uppercase section header
    const cleanHeader = line
      .replace(/^#+\s*/, "")
      .replace(/^[*_]+|[*_]+$/g, "")
      .trim();
    // Do not match inline properties like "Languages: TypeScript, JavaScript" as section headers
    if (
      cleanHeader.includes(":") &&
      cleanHeader.split(":")[1].trim().length > 0
    ) {
      return;
    }
    for (const [key, pat] of Object.entries(SECTION_PATTERNS)) {
      if (pat.test(cleanHeader)) {
        sections.push({ key, lineIdx: idx, title: cleanHeader });
        break;
      }
    }
  });

  // Top header (before first section)
  const firstSectionIdx =
    sections.length > 0 ? sections[0].lineIdx : Math.min(lines.length, 6);
  const headerLines = lines.slice(0, firstSectionIdx);

  if (headerLines.length > 0) {
    // Strip markdown formatting if any
    const firstLine = headerLines[0]
      .replace(/^#+\s*/, "")
      .replace(/^[*_]+|[*_]+$/g, "")
      .trim();
    if (firstLine.includes("|")) {
      const parts = firstLine.split("|").map((p) => p.trim());
      fullName = parts[0];
      if (parts[1] && !parts[1].includes("@")) headline = parts[1];
    } else {
      fullName = firstLine;
    }
  }

  if (headerLines.length > 1 && !headline) {
    const secondLine = headerLines[1]
      .replace(/^#+\s*/, "")
      .replace(/^[*_]+|[*_]+$/g, "")
      .trim();
    if (
      !secondLine.includes("@") &&
      !secondLine.toLowerCase().includes("github") &&
      !secondLine.toLowerCase().includes("linkedin") &&
      !secondLine.includes("http")
    ) {
      headline = secondLine;
    }
  }

  // Check header lines for location
  for (const line of headerLines) {
    const parts = line.split("|").map((p) => p.trim());
    for (const p of parts) {
      if (
        !p.includes("@") &&
        !p.toLowerCase().includes("github") &&
        !p.toLowerCase().includes("linkedin") &&
        !p.includes("http") &&
        !p.toLowerCase().includes("present")
      ) {
        if (
          p.includes(",") &&
          !p.toLowerCase().includes("developer") &&
          !p.toLowerCase().includes("engineer") &&
          !p.toLowerCase().includes("manager")
        ) {
          location = p;
        }
      }
    }
  }

  // Extract slices for each section
  const sectionContent: Record<string, string[]> = {};
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const nextSec = sections[i + 1];
    const endIdx = nextSec ? nextSec.lineIdx : lines.length;
    sectionContent[sec.key] = lines.slice(sec.lineIdx + 1, endIdx);
  }

  // Summary
  let summary = "";
  if (sectionContent.summary) {
    summary = sectionContent.summary
      .filter((l) => !l.startsWith("|--"))
      .join(" ");
  }

  // Skills
  const skills: Array<{ id: string; category: string; skills: string[] }> = [];
  if (sectionContent.skills) {
    sectionContent.skills.forEach((line, idx) => {
      // Ignore table separator rows
      if (/^\|?\s*[-:]+[-| :]*$/.test(line)) return;

      // Check for Markdown table row: | Category | Skill1, Skill2 |
      if (line.includes("|")) {
        const cells = line
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean);
        if (cells.length >= 2) {
          const cat = cells[0];
          const rawSkillItems = cells.slice(1).join(", ");
          const skillList = rawSkillItems
            .split(/[,•;]/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (skillList.length > 0) {
            skills.push({
              id: `skill-import-${skills.length + 1}`,
              category: cat,
              skills: skillList,
            });
            return;
          }
        }
      }

      // Standard Category: Skill1, Skill2
      if (line.includes(":")) {
        const [cat, items] = line.split(":", 2);
        const skillList = items
          .split(/[,•;]/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (skillList.length > 0) {
          skills.push({
            id: `skill-import-${skills.length + 1}`,
            category: cat.trim(),
            skills: skillList,
          });
        }
      }
    });

    if (skills.length === 0 && sectionContent.skills.length > 0) {
      const flatSkills = sectionContent.skills
        .filter((l) => !/^\|?\s*[-:]+[-| :]*$/.test(l))
        .flatMap((l) => l.split(/[,•;]/))
        .map((s) =>
          s
            .replace(/^[•\-*▪◦→‣]\s*/, "")
            .replace(/^\|+|\|+$/g, "")
            .trim(),
        )
        .filter(Boolean);
      if (flatSkills.length > 0) {
        skills.push({
          id: "skill-import-1",
          category: "Technical Skills",
          skills: flatSkills,
        });
      }
    }
  }

  // Helper date range matcher
  const DATE_RANGE_REGEX =
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4})\s*(?:–|-|to)\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4}|Present|Current|Now)/i;

  const isBulletLine = (l: string) =>
    /^(?:\\?[•\-*▪◦→‣¢“ƒ\+]|\\?\d+[\.\)])\s*/.test(l);

  // Experience
  const experience: Array<{
    id: string;
    jobTitle: string;
    position: string;
    company: string;
    location: string;
    employmentType: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string;
    bullets: string[];
    technologiesUsed: string[];
  }> = [];

  if (sectionContent.experience) {
    let currentExp: (typeof experience)[0] | null = null;
    const expLines = sectionContent.experience.filter(
      (l) => !/^\|?\s*[-:]+[-| :]*$/.test(l),
    );

    for (let i = 0; i < expLines.length; i++) {
      const line = expLines[i];
      const isBullet = isBulletLine(line);

      // Check if line is a pipe-delimited entry: Title | Company | Dates
      if (line.includes("|") && !isBullet) {
        if (currentExp) experience.push(currentExp);
        const parts = line.split("|").map((p) => p.trim());
        const jobTitle = parts[0] || "Software Engineer";
        const company = parts[1] || "Company";
        const dateRange = parts[2] || "";

        let startDate = "";
        let endDate = "";
        let current = false;
        if (dateRange) {
          const dateMatch = dateRange.match(DATE_RANGE_REGEX);
          if (dateMatch) {
            startDate = dateMatch[1];
            endDate = /present|current|now/i.test(dateMatch[2])
              ? ""
              : dateMatch[2];
            current = /present|current|now/i.test(dateMatch[2]);
          } else {
            const dateParts = dateRange.split(/[–\-]|to/i).map((d) => d.trim());
            startDate = dateParts[0] || "";
            if (dateParts[1]) {
              current = /present|current|now/i.test(dateParts[1]);
              endDate = current ? "" : dateParts[1];
            }
          }
        }
        currentExp = {
          id: `exp-import-${experience.length + 1}`,
          jobTitle,
          position: jobTitle,
          company,
          location: parts[3] || "",
          employmentType: "Full-time",
          startDate,
          endDate,
          current,
          description: "",
          bullets: [],
          technologiesUsed: [],
        };
      }
      // Check if line contains a date range (Multi-line or Parenthesized format)
      else if (!isBullet && DATE_RANGE_REGEX.test(line)) {
        if (currentExp) experience.push(currentExp);

        const dateMatch = line.match(DATE_RANGE_REGEX);
        const startDate = dateMatch ? dateMatch[1] : "";
        const current = dateMatch
          ? /present|current|now/i.test(dateMatch[2])
          : false;
        const endDate = dateMatch && !current ? dateMatch[2] : "";

        // Text before or around the date
        const textWithoutDate = line
          .replace(DATE_RANGE_REGEX, "")
          .replace(/[\(\)\[\],|–\-]/g, " ")
          .trim();
        let jobTitle = textWithoutDate || "Professional";
        let company = "Company";

        if (textWithoutDate.includes("•")) {
          const parts = textWithoutDate.split("•");
          jobTitle = parts[0].trim();
          company = parts.slice(1).join(" ").trim() || "Company";
        } else if (textWithoutDate.includes(" at ")) {
          const splitAt = textWithoutDate.split(" at ");
          jobTitle = splitAt[0].trim();
          company = splitAt[1].trim();
        } else if (i > 0 && !isBulletLine(expLines[i - 1])) {
          // If previous line has company or title
          company = jobTitle;
          jobTitle = expLines[i - 1];
        }

        currentExp = {
          id: `exp-import-${experience.length + 1}`,
          jobTitle,
          position: jobTitle,
          company,
          location: "",
          employmentType: "Full-time",
          startDate,
          endDate,
          current,
          description: "",
          bullets: [],
          technologiesUsed: [],
        };
      }
      // Check if line is a Role/Company header: Title — Company, Title - Company, Title at Company, or followed by bullet
      else if (
        !isBullet &&
        (line.includes("—") ||
          line.includes("–") ||
          line.includes(" - ") ||
          line.includes(" at ") ||
          (i + 1 < expLines.length && isBulletLine(expLines[i + 1])) ||
          !currentExp)
      ) {
        if (currentExp) experience.push(currentExp);

        let jobTitle = "Software Developer";
        let company = "Company";

        if (line.includes("—")) {
          const parts = line.split(/\s*—\s*/);
          jobTitle = parts[0]?.trim() || jobTitle;
          company = parts[1]?.trim() || company;
        } else if (line.includes("–")) {
          const parts = line.split(/\s*–\s*/);
          jobTitle = parts[0]?.trim() || jobTitle;
          company = parts[1]?.trim() || company;
        } else if (line.includes(" - ")) {
          const parts = line.split(/\s+-\s+/);
          jobTitle = parts[0]?.trim() || jobTitle;
          company = parts[1]?.trim() || company;
        } else if (line.includes(" at ")) {
          const parts = line.split(/\s+at\s+/i);
          jobTitle = parts[0]?.trim() || jobTitle;
          company = parts[1]?.trim() || company;
        } else if (line.includes(",")) {
          const parts = line.split(",");
          jobTitle = parts[0]?.trim() || jobTitle;
          company = parts[1]?.trim() || company;
        } else {
          jobTitle = line.trim();
        }

        currentExp = {
          id: `exp-import-${experience.length + 1}`,
          jobTitle,
          position: jobTitle,
          company,
          location: "",
          employmentType: "Full-time",
          startDate: "",
          endDate: "",
          current: false,
          description: "",
          bullets: [],
          technologiesUsed: [],
        };
      } else if (isBullet && currentExp) {
        currentExp.bullets.push(
          line.replace(/^(?:\\?[•\-*▪◦→‣¢“ƒ\+]|\\?\d+[\.\)])\s*/, "").trim(),
        );
      } else if (currentExp) {
        if (currentExp.bullets.length > 0) {
          currentExp.bullets[currentExp.bullets.length - 1] += " " + line;
        } else {
          currentExp.description += (currentExp.description ? " " : "") + line;
        }
      }
    }
    if (currentExp) experience.push(currentExp);
  }

  // Projects
  const projects: Array<{
    id: string;
    name: string;
    description: string;
    role: string;
    technologies: string[];
    startDate: string;
    endDate: string;
    url: string;
    repoUrl: string;
    bullets: string[];
    highlights: string[];
  }> = [];

  if (sectionContent.projects) {
    let currentProj: (typeof projects)[0] | null = null;
    const projLines = sectionContent.projects.filter(
      (l) => !/^\|?\s*[-:]+[-| :]*$/.test(l),
    );

    for (let i = 0; i < projLines.length; i++) {
      const line = projLines[i];
      const isBullet = isBulletLine(line);
      const isFollowedByBullet =
        i + 1 < projLines.length && isBulletLine(projLines[i + 1]);
      const isFollowedByTools =
        i + 1 < projLines.length &&
        /^(?:tools|tech|technologies|tech\s*stack):/i.test(projLines[i + 1]);
      const isEmailOrUrlOnly = /^\[Link\]\(mailto:|^https?:\/\//i.test(line);

      // Detect project heading: Name | Techs or Name (Techs) or ### Name or Line followed by bullet or Tools:
      const isHeading =
        !isBullet &&
        !isEmailOrUrlOnly &&
        (line.includes("|") ||
          /^#{2,4}\s+/.test(line) ||
          (line.includes("[") && line.includes("]") && !line.includes("mailto:")) ||
          (line.length < 80 && !line.endsWith(".") && (isFollowedByBullet || isFollowedByTools)) ||
          (line.length < 80 &&
            !line.endsWith(".") &&
            (line.includes("(") ||
              line.includes(" - ") ||
              line.includes(" — ") ||
              line.includes(" – "))));

      if (isHeading) {
        if (currentProj) projects.push(currentProj);

        let name = line.replace(/^#{2,4}\s+/, "").trim();
        let technologies: string[] = [];
        let url = "";

        // Extract markdown URL if present: [Title](url)
        const linkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/);
        if (linkMatch) {
          url = linkMatch[2];
          name = linkMatch[1];
        }

        if (name.includes("|")) {
          const parts = name.split("|").map((p) => p.trim());
          name = parts[0];
          if (parts[1]) {
            technologies = parts[1]
              .split(/[,•;]/)
              .map((t) => t.trim())
              .filter(Boolean);
          }
        } else if (name.includes("(") && name.includes(")")) {
          const match = name.match(/^(.*?)\((.*?)\)/);
          if (match) {
            name = match[1].trim();
            technologies = match[2]
              .split(/[,•;]/)
              .map((t) => t.trim())
              .filter(Boolean);
          }
        } else if (name.includes(" — ")) {
          const parts = name.split(/\s*—\s*/);
          name = parts[0].trim();
          if (parts[1]) {
            technologies = parts[1]
              .split(/[,•;]/)
              .map((t) => t.trim())
              .filter(Boolean);
          }
        } else if (name.includes(" – ")) {
          const parts = name.split(/\s*–\s*/);
          name = parts[0].trim();
          if (parts[1]) {
            technologies = parts[1]
              .split(/[,•;]/)
              .map((t) => t.trim())
              .filter(Boolean);
          }
        } else if (name.includes(" - ")) {
          const parts = name.split(/\s+-\s+/);
          name = parts[0].trim();
          if (parts[1]) {
            technologies = parts[1]
              .split(/[,•;]/)
              .map((t) => t.trim())
              .filter(Boolean);
          }
        }

        currentProj = {
          id: `proj-import-${projects.length + 1}`,
          name: name || "Project",
          description: "",
          role: "",
          technologies,
          startDate: "",
          endDate: "",
          url,
          repoUrl: url.includes("github.com") ? url : "",
          bullets: [],
          highlights: [],
        };
      } else if (isBullet && currentProj) {
        currentProj.bullets.push(
          line.replace(/^(?:\\?[•\-*▪◦→‣¢“ƒ\+]|\\?\d+[\.\)])\s*/, "").trim(),
        );
      } else if (currentProj) {
        if (
          line.toLowerCase().startsWith("technologies:") ||
          line.toLowerCase().startsWith("tech stack:") ||
          line.toLowerCase().startsWith("tools:")
        ) {
          const techs = line
            .replace(/^(technologies|tech stack|tools):\s*/i, "")
            .split(/[,•;]/)
            .map((t) => t.trim())
            .filter(Boolean);
          currentProj.technologies = Array.from(
            new Set([...currentProj.technologies, ...techs]),
          );
        } else if (currentProj.bullets.length > 0) {
          currentProj.bullets[currentProj.bullets.length - 1] += " " + line;
        } else {
          currentProj.description +=
            (currentProj.description ? " " : "") + line;
        }
      }
    }
    if (currentProj) projects.push(currentProj);
  }

  // Education
  const education: Array<{
    id: string;
    institution: string;
    degree: string;
    fieldOfStudy: string;
    location: string;
    startDate: string;
    endDate: string;
    current: boolean;
    gpa: string;
    description: string;
    honors: string[];
  }> = [];

  if (sectionContent.education) {
    let currentEdu: (typeof education)[0] | null = null;
    const eduLines = sectionContent.education.filter(
      (l) => !/^\|?\s*[-:]+[-| :]*$/.test(l),
    );

    for (const line of eduLines) {
      if (line.includes("|")) {
        if (currentEdu) education.push(currentEdu);
        const parts = line.split("|").map((p) => p.trim());
        let degree = parts[0] || "Degree";
        let fieldOfStudy = "";

        // Extract dates if in parts[0], e.g. (2021–2025)
        let startDate = "";
        let endDate = "";
        const dateMatchInPart0 = degree.match(
          /\(?(\d{4})\s*(?:–|-|to)\s*(\d{4}|Present|Current)\)?/i,
        );
        if (dateMatchInPart0) {
          startDate = dateMatchInPart0[1];
          endDate = dateMatchInPart0[2];
          degree = degree.replace(dateMatchInPart0[0], "").trim();
        }

        if (degree.toLowerCase().includes(" in ")) {
          const degParts = degree.split(/ in /i);
          degree = degParts[0].trim();
          fieldOfStudy = degParts[1].trim();
        }

        let institution = "";
        let gpa = "";

        // Check if line contains CGPA or GPA
        const gpaMatch = line.match(
          /(?:CGPA|GPA)[:\s]*([0-9.]+(?:\s*\/\s*[0-9.]+)?)/i,
        );
        if (gpaMatch) {
          gpa = gpaMatch[1];
        }

        for (let pIdx = 1; pIdx < parts.length; pIdx++) {
          const p = parts[pIdx];
          if (/(?:CGPA|GPA)/i.test(p)) {
            continue;
          }
          if (DATE_RANGE_REGEX.test(p)) {
            const dateParts = p.split(/[–\-]|to/i).map((d) => d.trim());
            startDate = dateParts[0] || startDate;
            endDate = dateParts[1] || endDate;
            continue;
          }
          if (!institution) {
            institution = p;
          }
        }

        if (!institution) {
          institution = "University / College";
        }

        currentEdu = {
          id: `edu-import-${education.length + 1}`,
          institution,
          degree: degree || "Degree",
          fieldOfStudy,
          location: "",
          startDate,
          endDate,
          current: false,
          gpa,
          description: "",
          honors: [],
        };
      } else if (
        /(Bachelor|Master|B\.Tech|M\.Tech|B\.S\.|M\.S\.|PhD|Associate|Diploma)/i.test(
          line,
        )
      ) {
        if (currentEdu) education.push(currentEdu);
        let degreeLine = line;
        let startDate = "";
        let endDate = "";
        const dateMatch = degreeLine.match(DATE_RANGE_REGEX);
        if (dateMatch) {
          startDate = dateMatch[1];
          endDate = /present|current|now/i.test(dateMatch[2]) ? "" : dateMatch[2];
          degreeLine = degreeLine.replace(DATE_RANGE_REGEX, "").trim();
        }

        let degree = degreeLine;
        let fieldOfStudy = "";
        if (degree.toLowerCase().includes(" in ")) {
          const degParts = degree.split(/ in /i);
          degree = degParts[0].trim();
          fieldOfStudy = degParts[1].trim();
        }
        currentEdu = {
          id: `edu-import-${education.length + 1}`,
          institution: "University",
          degree,
          fieldOfStudy,
          location: "",
          startDate,
          endDate,
          current: false,
          gpa: "",
          description: "",
          honors: [],
        };
      } else if (/cgpa|gpa/i.test(line)) {
        const gpaMatch = line.match(
          /(?:cgpa|gpa)\s*[:\-]?\s*([0-9.]+(?:\s*\/\s*[0-9.]+)?)/i,
        );
        if (gpaMatch && currentEdu) {
          currentEdu.gpa = gpaMatch[1];
        }
        if (currentEdu && (currentEdu.institution === "University" || !currentEdu.institution)) {
          const instText = line
            .replace(/•?\s*(?:cgpa|gpa)\s*[:\-]?\s*[0-9.]+(?:\s*\/\s*[0-9.]+)?/i, "")
            .replace(/^•|•$/g, "")
            .trim();
          if (instText && !instText.includes("@")) {
            currentEdu.institution = instText;
          }
        }
      } else if (
        currentEdu &&
        (currentEdu.institution === "University" || !currentEdu.institution) &&
        !line.includes("@")
      ) {
        currentEdu.institution = line.trim();
      }
    }
    if (currentEdu) education.push(currentEdu);
  }

  // Certifications
  const certifications: Array<{
    id: string;
    name: string;
    issuer: string;
    issueDate: string;
    expirationDate: string;
    credentialId: string;
    url: string;
  }> = [];

  if (sectionContent.certifications) {
    const certLines = sectionContent.certifications.filter(
      (l) => !/^\|?\s*[-:]+[-| :]*$/.test(l),
    );
    for (const line of certLines) {
      if (!line.trim()) continue;
      const parts = line
        .split(/[|–\-]/)
        .map((p) => p.trim())
        .filter(Boolean);
      const name = parts[0] || line.trim();
      const issuer = parts[1] || "Certification Authority";
      const issueDate = parts[2] || "";

      // Extract markdown URL if present
      const urlMatch = line.match(/https?:\/\/[^\s\)]+/);
      const url = urlMatch ? urlMatch[0] : "";

      certifications.push({
        id: `cert-import-${certifications.length + 1}`,
        name: name.replace(/^[•\-*▪◦→‣]\s*/, ""),
        issuer,
        issueDate,
        expirationDate: "",
        credentialId: "",
        url,
      });
    }
  }

  // Achievements
  const achievements: Array<{
    id: string;
    title: string;
    description: string;
    date: string;
  }> = [];

  if (sectionContent.achievements) {
    const achLines = sectionContent.achievements.filter(
      (l) => !/^\|?\s*[-:]+[-| :]*$/.test(l),
    );
    for (const line of achLines) {
      if (!line.trim()) continue;
      const cleanLine = line.replace(/^[•\-*▪◦→‣]\s*/, "").trim();
      achievements.push({
        id: `ach-import-${achievements.length + 1}`,
        title: cleanLine,
        description: cleanLine,
        date: "",
      });
    }
  }

  // Languages
  const languages: Array<{
    id: string;
    language: string;
    proficiency: string;
  }> = [];

  if (sectionContent.languages) {
    const normalizeLanguageProficiency = (
      raw: string,
    ): "Basic" | "Conversational" | "Professional" | "Fluent" | "Native" => {
      const p = (raw || "").toLowerCase();
      if (
        p.includes("native") ||
        p.includes("mother") ||
        p.includes("bilingual")
      )
        return "Native";
      if (p.includes("fluent")) return "Fluent";
      if (p.includes("conversational") || p.includes("intermediate"))
        return "Conversational";
      if (
        p.includes("basic") ||
        p.includes("elementary") ||
        p.includes("beginner")
      )
        return "Basic";
      return "Professional";
    };

    const langLines = sectionContent.languages.filter(
      (l) => !/^\|?\s*[-:]+[-| :]*$/.test(l),
    );
    for (const line of langLines) {
      const items = line
        .split(/[,;•]/)
        .map((i) => i.trim())
        .filter(Boolean);
      for (const item of items) {
        if (!item) continue;
        let language = item;
        let proficiency = "Professional";
        if (item.includes("(") && item.includes(")")) {
          const match = item.match(/^(.*?)\((.*?)\)/);
          if (match) {
            language = match[1].trim();
            proficiency = match[2].trim();
          }
        } else if (item.includes("-")) {
          const parts = item.split("-").map((p) => p.trim());
          language = parts[0];
          proficiency = parts[1] || proficiency;
        }
        languages.push({
          id: `lang-import-${languages.length + 1}`,
          language,
          proficiency: normalizeLanguageProficiency(proficiency),
        });
      }
    }
  }

  // Links
  const links: Array<{
    id: string;
    label: string;
    url: string;
  }> = [];

  if (githubUrl) {
    links.push({
      id: `link-import-${links.length + 1}`,
      label: "GitHub",
      url: githubUrl,
    });
  }
  if (linkedinUrl) {
    links.push({
      id: `link-import-${links.length + 1}`,
      label: "LinkedIn",
      url: linkedinUrl,
    });
  }
  if (website) {
    links.push({
      id: `link-import-${links.length + 1}`,
      label: "Portfolio",
      url: website,
    });
  }

  // Also collect any other markdown links
  const allMdLinks = cleanedText.matchAll(
    /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
  );
  for (const m of allMdLinks) {
    const label = m[1].trim();
    const url = m[2].trim();
    if (!links.some((l) => l.url === url)) {
      links.push({ id: `link-import-${links.length + 1}`, label, url });
    }
  }

  const rawResult = {
    resumeData: {
      personalInfo: {
        fullName: fullName || "Imported Candidate",
        headline,
        email,
        phone,
        location,
        website,
        linkedin,
        github,
        linkedinUrl,
        githubUrl,
        portfolioUrl: website,
      },
      summary,
      experience,
      education,
      projects,
      skills,
      certifications,
      achievements,
      languages,
      links,
      sectionVisibility: {
        showSummary: Boolean(summary),
        showExperience: experience.length > 0,
        showEducation: education.length > 0,
        showProjects: projects.length > 0,
        showSkills: skills.length > 0,
        showCertifications: certifications.length > 0,
        showAchievements: achievements.length > 0,
        showLanguages: languages.length > 0,
        showLinks: links.length > 0,
      },
      sectionOrder: [
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "certifications",
        "achievements",
        "languages",
        "links",
      ],
    },
    confidence: {
      personalInfo: fullName && email ? 0.95 : 0.6,
      summary: summary ? 0.9 : 0.0,
      experience: experience.length > 0 ? 0.92 : 0.0,
      education: education.length > 0 ? 0.9 : 0.0,
      skills: skills.length > 0 ? 0.95 : 0.0,
      projects: projects.length > 0 ? 0.9 : 0.0,
      certifications: certifications.length > 0 ? 0.85 : 0.0,
      achievements: achievements.length > 0 ? 0.8 : 0.0,
      languages: languages.length > 0 ? 0.85 : 0.0,
      links: links.length > 0 ? 0.9 : 0.0,
      overall: 0.88,
    },
    warnings: [],
  };

  return ResumeParseResultSchema.parse(rawResult);
}
