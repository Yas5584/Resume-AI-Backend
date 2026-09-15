import {
  ResumeData,
  TemplateConfig,
  COLOR_PALETTES,
  AccentColor,
  normalizeTemplateId,
} from "@resumeai/shared";

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("vbscript:")
  ) {
    return null;
  }
  return escapeHtml(trimmed);
}

export function renderResumeToHtml(
  data: ResumeData,
  config: TemplateConfig,
  title?: string,
): string {
  const canonicalTemplate = normalizeTemplateId(config.templateId);
  const accentDef =
    COLOR_PALETTES[
      (config.accentColor in COLOR_PALETTES
        ? config.accentColor
        : "blue") as AccentColor
    ] || COLOR_PALETTES.blue;
  const accentHex = accentDef.hex;

  // Paper & Margin Dimensions
  const isA4 = config.pageSize === "a4";
  const pageMargin =
    config.margins === "compact"
      ? "12mm"
      : config.margins === "relaxed"
        ? "22mm"
        : "16mm";

  // Typography Settings
  let fontFamily =
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  if (config.fontFamily === "Georgia") {
    fontFamily = "Georgia, Cambria, 'Times New Roman', Times, serif";
  } else if (config.fontFamily === "Times New Roman") {
    fontFamily = "'Times New Roman', Times, Georgia, serif";
  } else if (config.fontFamily === "Arial") {
    fontFamily = "Arial, 'Helvetica Neue', Helvetica, sans-serif";
  } else if (config.fontFamily === "Helvetica") {
    fontFamily = "'Helvetica Neue', Helvetica, Arial, sans-serif";
  }

  // Font Size Scale
  let baseFontSize = "12px";
  let nameFontSize = "22px";
  let sectionTitleFontSize = "13px";
  let itemTitleFontSize = "13px";
  let metaFontSize = "11px";

  if (config.fontSize === "sm") {
    baseFontSize = "11px";
    nameFontSize = "19px";
    sectionTitleFontSize = "12px";
    itemTitleFontSize = "12px";
    metaFontSize = "10px";
  } else if (config.fontSize === "lg") {
    baseFontSize = "13.5px";
    nameFontSize = "26px";
    sectionTitleFontSize = "14.5px";
    itemTitleFontSize = "14.5px";
    metaFontSize = "12px";
  }

  // Spacing Scale
  let sectionGap = "14px";
  let itemGap = "8px";
  let listGap = "3px";
  let lineHeight = "1.45";

  if (config.spacing === "compact") {
    sectionGap = "10px";
    itemGap = "5px";
    listGap = "2px";
    lineHeight = "1.35";
  } else if (config.spacing === "spacious") {
    sectionGap = "18px";
    itemGap = "12px";
    listGap = "5px";
    lineHeight = "1.6";
  }

  const {
    personalInfo = {
      fullName: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      website: "",
      linkedin: "",
      github: "",
    },
    summary = "",
    experience = [],
    education = [],
    projects = [],
    skills = [],
    certifications = [],
    achievements = [],
    languages = [],
    links = [],
    sectionVisibility = {
      showSummary: true,
      showExperience: true,
      showEducation: true,
      showProjects: true,
      showSkills: true,
      showCertifications: true,
      showAchievements: true,
      showLanguages: true,
      showLinks: true,
    },
    sectionOrder = [
      "summary",
      "experience",
      "education",
      "projects",
      "skills",
      "certifications",
      "achievements",
      "languages",
      "links",
    ],
  } = data;

  const safeWebsite = sanitizeUrl(personalInfo.website);
  const safeLinkedin = sanitizeUrl(personalInfo.linkedin);
  const safeGithub = sanitizeUrl(personalInfo.github);

  // Helper to generate section heading HTML depending on template
  function renderSectionHeader(label: string): string {
    if (canonicalTemplate === "classic") {
      return `
        <div class="section-title" style="text-align: center; border-bottom: 1px solid ${accentHex}; padding-bottom: 3px; margin-bottom: 6px;">
          <h2 style="font-size: ${sectionTitleFontSize}; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; color: #111827;">
            ${escapeHtml(label)}
          </h2>
        </div>
      `;
    }

    if (canonicalTemplate === "executive") {
      return `
        <div class="section-title" style="border-left: 4px solid ${accentHex}; padding-left: 8px; margin-bottom: 6px;">
          <h2 style="font-size: ${sectionTitleFontSize}; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; color: ${accentHex};">
            ${escapeHtml(label)}
          </h2>
        </div>
      `;
    }

    if (canonicalTemplate === "minimal") {
      return `
        <div class="section-title" style="margin-bottom: 5px;">
          <h2 style="font-size: ${sectionTitleFontSize}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; margin: 0; color: #6b7280;">
            ${escapeHtml(label)}
          </h2>
        </div>
      `;
    }

    // Default / Modern
    return `
      <div class="section-title" style="display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 6px;">
        <span style="width: 4px; height: 13px; background-color: ${accentHex}; border-radius: 2px; display: inline-block;"></span>
        <h2 style="font-size: ${sectionTitleFontSize}; font-weight: bold; text-transform: uppercase; letter-spacing: 0.06em; margin: 0; color: #111827;">
          ${escapeHtml(label)}
        </h2>
      </div>
    `;
  }

  // Section Generators
  function renderSummaryHtml(): string {
    if (!sectionVisibility.showSummary || !summary?.trim()) return "";
    return `
      <section class="section-block entry-block" style="margin-bottom: ${sectionGap};">
        ${renderSectionHeader(canonicalTemplate === "classic" ? "Summary" : canonicalTemplate === "executive" ? "Executive Summary" : "Professional Summary")}
        <p style="margin: 0; color: #374151; white-space: pre-line; text-align: ${canonicalTemplate === "classic" ? "justify" : "left"};">
          ${escapeHtml(summary)}
        </p>
      </section>
    `;
  }

  function renderExperienceHtml(): string {
    if (!sectionVisibility.showExperience || experience.length === 0) return "";
    const itemsHtml = experience
      .map((exp) => {
        const title = escapeHtml(exp.position || exp.jobTitle || "Role");
        const company = escapeHtml(exp.company || "Company");
        const dateRange = `${escapeHtml(exp.startDate || "")} – ${exp.current ? "Present" : escapeHtml(exp.endDate || "Present")}`;
        const loc = exp.location ? ` | ${escapeHtml(exp.location)}` : "";
        const bullets = (
          exp.bullets && exp.bullets.length > 0 ? exp.bullets : []
        )
          .map(
            (b) =>
              `<li style="margin-bottom: ${listGap};">${escapeHtml(b)}</li>`,
          )
          .join("");

        return `
          <div class="entry-block" style="margin-bottom: ${itemGap};">
            <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap;">
              <div>
                <strong style="font-size: ${itemTitleFontSize}; color: #111827;">${title}</strong>
                <span style="color: #4b5563; margin-left: 4px;">• ${company}</span>
              </div>
              <div style="font-size: ${metaFontSize}; color: #6b7280; font-style: ${canonicalTemplate === "classic" ? "italic" : "normal"};">
                ${dateRange}${loc}
              </div>
            </div>
            ${bullets ? `<ul style="margin: 4px 0 0 16px; padding: 0; color: #374151;">${bullets}</ul>` : ""}
          </div>
        `;
      })
      .join("");

    return `
      <section class="section-block" style="margin-bottom: ${sectionGap};">
        ${renderSectionHeader(canonicalTemplate === "classic" ? "Professional Experience" : "Work Experience")}
        ${itemsHtml}
      </section>
    `;
  }

  function renderEducationHtml(): string {
    if (!sectionVisibility.showEducation || education.length === 0) return "";
    const itemsHtml = education
      .map((edu) => {
        const degree = escapeHtml(edu.degree || "");
        const field = edu.fieldOfStudy
          ? ` in ${escapeHtml(edu.fieldOfStudy)}`
          : "";
        const inst = escapeHtml(edu.institution || "");
        const dateRange = `${escapeHtml(edu.startDate || "")}${edu.startDate ? " – " : ""}${edu.current ? "Present" : escapeHtml(edu.endDate || "")}`;
        const gpa = edu.gpa ? ` • GPA: ${escapeHtml(edu.gpa)}` : "";
        const honors =
          edu.honors && edu.honors.length > 0
            ? ` • ${escapeHtml(edu.honors.join(", "))}`
            : "";
        const loc = edu.location ? ` • ${escapeHtml(edu.location)}` : "";

        return `
          <div class="entry-block" style="margin-bottom: ${itemGap};">
            <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap;">
              <strong style="font-size: ${itemTitleFontSize}; color: #111827;">${degree}${field}</strong>
              <span style="font-size: ${metaFontSize}; color: #6b7280; font-style: ${canonicalTemplate === "classic" ? "italic" : "normal"};">${dateRange}</span>
            </div>
            <div style="font-size: ${metaFontSize}; color: #4b5563; margin-top: 1px;">
              <span>${inst}</span>${loc}${gpa}${honors}
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <section class="section-block" style="margin-bottom: ${sectionGap};">
        ${renderSectionHeader("Education")}
        ${itemsHtml}
      </section>
    `;
  }

  function renderProjectsHtml(): string {
    if (!sectionVisibility.showProjects || projects.length === 0) return "";
    const itemsHtml = projects
      .map((proj) => {
        const name = escapeHtml(proj.name || "");
        const role = proj.role ? ` (${escapeHtml(proj.role)})` : "";
        const safeUrl = sanitizeUrl(proj.url);
        const desc = proj.description
          ? `<p style="margin: 2px 0 3px 0; color: #374151;">${escapeHtml(proj.description)}</p>`
          : "";
        const projectBullets =
          proj.bullets && proj.bullets.length > 0
            ? proj.bullets
            : proj.highlights;
        const bulletsHtml =
          projectBullets && projectBullets.length > 0
            ? `<ul style="margin: 3px 0 0 16px; padding: 0; color: #374151;">${projectBullets.map((b) => `<li style="margin-bottom: ${listGap};">${escapeHtml(b)}</li>`).join("")}</ul>`
            : "";

        const techHtml =
          proj.technologies && proj.technologies.length > 0
            ? `<div style="font-size: ${metaFontSize}; color: #6b7280; margin-top: 2px;">Tools: ${proj.technologies.map(escapeHtml).join(", ")}</div>`
            : "";

        return `
          <div class="entry-block" style="margin-bottom: ${itemGap};">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div>
                <strong style="font-size: ${itemTitleFontSize}; color: #111827;">${name}</strong>
                <span style="color: #6b7280; font-size: ${metaFontSize};">${role}</span>
              </div>
              ${safeUrl ? `<a href="${safeUrl}" target="_blank" style="color: ${accentHex}; font-size: ${metaFontSize}; text-decoration: underline;">Link ↗</a>` : ""}
            </div>
            ${desc}
            ${techHtml}
            ${bulletsHtml}
          </div>
        `;
      })
      .join("");

    return `
      <section class="section-block" style="margin-bottom: ${sectionGap};">
        ${renderSectionHeader("Projects")}
        ${itemsHtml}
      </section>
    `;
  }

  function renderSkillsHtml(): string {
    if (!sectionVisibility.showSkills || skills.length === 0) return "";

    let contentHtml = "";
    if (canonicalTemplate === "classic" || canonicalTemplate === "minimal") {
      contentHtml = skills
        .map(
          (sg) => {
            const skillList = Array.isArray(sg.skills) ? sg.skills : Array.isArray((sg as any).items) ? (sg as any).items : [];
            return `
          <div style="margin-bottom: 3px;">
            <strong style="color: #111827;">${escapeHtml(sg.category)}:</strong>
            <span style="color: #374151; margin-left: 4px;">${skillList.map(escapeHtml).join(canonicalTemplate === "minimal" ? " · " : ", ")}</span>
          </div>
        `;
          },
        )
        .join("");
    } else {
      // Modern & Executive with badge styling
      contentHtml = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">
          ${skills
            .map(
              (sg) => {
                const skillList = Array.isArray(sg.skills) ? sg.skills : Array.isArray((sg as any).items) ? (sg as any).items : [];
                return `
            <div>
              <div style="font-weight: 600; color: #111827; font-size: ${itemTitleFontSize}; margin-bottom: 3px;">${escapeHtml(sg.category)}</div>
              <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                ${skillList
                  .map(
                    (s: string) => `
                  <span style="background-color: #f3f4f6; color: #1f2937; border: 1px solid #e5e7eb; border-radius: 3px; font-size: ${metaFontSize}; padding: 1px 5px; display: inline-block;">
                    ${escapeHtml(s)}
                  </span>
                `,
                  )
                  .join("")}
              </div>
            </div>
          `;
              },
            )
            .join("")}
        </div>
      `;
    }

    return `
      <section class="section-block entry-block" style="margin-bottom: ${sectionGap};">
        ${renderSectionHeader("Skills & Competencies")}
        ${contentHtml}
      </section>
    `;
  }

  function renderCertificationsHtml(): string {
    if (!sectionVisibility.showCertifications || certifications.length === 0)
      return "";
    const itemsHtml = certifications
      .map(
        (c) => `
        <div class="entry-block" style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px;">
          <div>
            <strong style="color: #111827;">${escapeHtml(c.name)}</strong>
            <span style="color: #4b5563;"> — ${escapeHtml(c.issuer)}</span>
          </div>
          ${c.issueDate ? `<span style="font-size: ${metaFontSize}; color: #6b7280;">${escapeHtml(c.issueDate)}</span>` : ""}
        </div>
      `,
      )
      .join("");

    return `
      <section class="section-block" style="margin-bottom: ${sectionGap};">
        ${renderSectionHeader("Certifications")}
        ${itemsHtml}
      </section>
    `;
  }

  function renderAchievementsHtml(): string {
    if (!sectionVisibility.showAchievements || achievements.length === 0)
      return "";
    const itemsHtml = achievements
      .map(
        (ach) => `
        <div class="entry-block" style="margin-bottom: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong style="color: #111827;">${escapeHtml(ach.title)}</strong>
            ${ach.date ? `<span style="font-size: ${metaFontSize}; color: #6b7280;">${escapeHtml(ach.date)}</span>` : ""}
          </div>
          ${ach.description ? `<p style="margin: 1px 0 0 0; color: #4b5563;">${escapeHtml(ach.description)}</p>` : ""}
        </div>
      `,
      )
      .join("");

    return `
      <section class="section-block" style="margin-bottom: ${sectionGap};">
        ${renderSectionHeader("Key Achievements")}
        ${itemsHtml}
      </section>
    `;
  }

  function renderLanguagesHtml(): string {
    if (!sectionVisibility.showLanguages || languages.length === 0) return "";
    const list = languages
      .map(
        (l) =>
          `${escapeHtml(l.language)}${l.proficiency ? ` (${escapeHtml(l.proficiency)})` : ""}`,
      )
      .join(" • ");

    return `
      <section class="section-block entry-block" style="margin-bottom: ${sectionGap};">
        ${renderSectionHeader("Languages")}
        <p style="margin: 0; color: #374151;">${list}</p>
      </section>
    `;
  }

  function renderLinksHtml(): string {
    if (!sectionVisibility.showLinks || links.length === 0) return "";
    const list = links
      .map((l) => {
        const safeUrl = sanitizeUrl(l.url);
        const label = escapeHtml(l.label || l.url);
        return safeUrl
          ? `<a href="${safeUrl}" target="_blank" style="color: ${accentHex}; text-decoration: underline; margin-right: 12px;">${label} ↗</a>`
          : `<span style="color: #374151; margin-right: 12px;">${label}</span>`;
      })
      .join("");

    return `
      <section class="section-block entry-block" style="margin-bottom: ${sectionGap};">
        ${renderSectionHeader("Additional Links")}
        <div>${list}</div>
      </section>
    `;
  }

  const sectionRenderers: Record<string, () => string> = {
    summary: renderSummaryHtml,
    experience: renderExperienceHtml,
    education: renderEducationHtml,
    projects: renderProjectsHtml,
    skills: renderSkillsHtml,
    certifications: renderCertificationsHtml,
    achievements: renderAchievementsHtml,
    languages: renderLanguagesHtml,
    links: renderLinksHtml,
  };

  const bodySectionsHtml = sectionOrder
    .map((secKey) =>
      sectionRenderers[secKey] ? sectionRenderers[secKey]() : "",
    )
    .join("");

  // Header HTML Generation
  let headerHtml = "";
  const contactParts: string[] = [];
  if (personalInfo.email) {
    contactParts.push(
      `<a href="mailto:${escapeHtml(personalInfo.email)}" style="color: inherit; text-decoration: none;">${escapeHtml(personalInfo.email)}</a>`,
    );
  }
  if (personalInfo.phone) contactParts.push(escapeHtml(personalInfo.phone));
  if (personalInfo.location)
    contactParts.push(escapeHtml(personalInfo.location));
  if (safeWebsite)
    contactParts.push(
      `<a href="${safeWebsite}" target="_blank" style="color: ${accentHex}; text-decoration: none;">Website</a>`,
    );
  if (safeLinkedin)
    contactParts.push(
      `<a href="${safeLinkedin}" target="_blank" style="color: ${accentHex}; text-decoration: none;">LinkedIn</a>`,
    );
  if (safeGithub)
    contactParts.push(
      `<a href="${safeGithub}" target="_blank" style="color: ${accentHex}; text-decoration: none;">GitHub</a>`,
    );

  if (canonicalTemplate === "classic") {
    headerHtml = `
      <header style="text-align: center; margin-bottom: ${sectionGap};">
        <h1 style="font-size: ${nameFontSize}; font-weight: bold; text-transform: uppercase; margin: 0 0 4px 0; color: #111827; letter-spacing: 0.05em;">
          ${escapeHtml(personalInfo.fullName || title || "Resume")}
        </h1>
        ${personalInfo.headline ? `<div style="font-size: ${baseFontSize}; font-style: italic; color: #4b5563; margin-bottom: 4px;">${escapeHtml(personalInfo.headline)}</div>` : ""}
        <div style="font-size: ${metaFontSize}; color: #4b5563;">
          ${contactParts.join(" • ")}
        </div>
      </header>
    `;
  } else if (canonicalTemplate === "executive") {
    headerHtml = `
      <header style="border-bottom: 2px solid ${accentHex}; padding-bottom: 8px; margin-bottom: ${sectionGap};">
        <h1 style="font-size: ${nameFontSize}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin: 0; color: #0f172a;">
          ${escapeHtml(personalInfo.fullName || title || "Resume")}
        </h1>
        ${personalInfo.headline ? `<div style="font-size: ${baseFontSize}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: ${accentHex}; margin-top: 3px;">${escapeHtml(personalInfo.headline)}</div>` : ""}
        <div style="font-size: ${metaFontSize}; color: #64748b; margin-top: 6px;">
          ${contactParts.join(" | ")}
        </div>
      </header>
    `;
  } else if (canonicalTemplate === "minimal") {
    headerHtml = `
      <header style="margin-bottom: ${sectionGap};">
        <h1 style="font-size: ${nameFontSize}; font-weight: 300; letter-spacing: -0.02em; margin: 0; color: #111827;">
          ${escapeHtml(personalInfo.fullName || title || "Resume")}
        </h1>
        ${personalInfo.headline ? `<div style="font-size: ${baseFontSize}; font-weight: normal; color: #6b7280; margin-top: 2px;">${escapeHtml(personalInfo.headline)}</div>` : ""}
        <div style="font-size: ${metaFontSize}; color: #6b7280; margin-top: 6px; font-family: monospace;">
          ${contactParts.join(" · ")}
        </div>
      </header>
    `;
  } else {
    // Modern
    headerHtml = `
      <header style="margin-bottom: ${sectionGap};">
        <h1 style="font-size: ${nameFontSize}; font-weight: 800; letter-spacing: -0.02em; margin: 0; color: #0f172a;">
          ${escapeHtml(personalInfo.fullName || title || "Resume")}
        </h1>
        ${personalInfo.headline ? `<div style="font-size: ${baseFontSize}; font-weight: 600; color: ${accentHex}; margin-top: 3px;">${escapeHtml(personalInfo.headline)}</div>` : ""}
        <div style="font-size: ${metaFontSize}; color: #4b5563; margin-top: 6px;">
          ${contactParts.join(" • ")}
        </div>
      </header>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(personalInfo.fullName || title || "Resume")}</title>
  <style>
    @page {
      size: ${isA4 ? "A4" : "letter"};
      margin: ${pageMargin};
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: #111827;
      font-family: ${fontFamily};
      font-size: ${baseFontSize};
      line-height: ${lineHeight};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    body {
      padding: 0;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .entry-block {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .section-title {
        break-after: avoid;
        page-break-after: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="resume-container">
    ${headerHtml}
    ${bodySectionsHtml}
  </div>
</body>
</html>`;
}
