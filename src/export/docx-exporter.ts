import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ExternalHyperlink,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  convertMillimetersToTwip,
} from "docx";
import {
  ResumeData,
  TemplateConfig,
  COLOR_PALETTES,
  AccentColor,
  normalizeTemplateId,
} from "@resumeai/shared";
import { ExportResult, ResumeExporter } from "./exporter.interface.js";
import { sanitizeFilename } from "./sanitize-filename.js";

function getSafeUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("vbscript:")
  ) {
    return null;
  }
  return trimmed;
}

export class DocxResumeExporter implements ResumeExporter {
  async export(
    data: ResumeData,
    config: TemplateConfig,
    title: string,
  ): Promise<ExportResult> {
    const canonicalTemplate = normalizeTemplateId(config.templateId);
    const accentDef =
      COLOR_PALETTES[
        (config.accentColor in COLOR_PALETTES
          ? config.accentColor
          : "blue") as AccentColor
      ] || COLOR_PALETTES.blue;
    const accentHex = accentDef.hex.replace(/^#/, "");

    // Font selection
    let fontName = "Calibri";
    if (config.fontFamily === "Georgia") fontName = "Georgia";
    else if (config.fontFamily === "Times New Roman")
      fontName = "Times New Roman";
    else if (config.fontFamily === "Arial") fontName = "Arial";
    else if (config.fontFamily === "Helvetica") fontName = "Arial";
    else if (config.fontFamily === "Inter") fontName = "Inter";

    // Typography sizing (half-points: 24 = 12pt)
    let bodySize = 22; // 11pt
    let nameSize = 40; // 20pt
    let sectionTitleSize = 24; // 12pt
    let itemTitleSize = 22; // 11pt
    let metaSize = 19; // 9.5pt

    if (config.fontSize === "sm") {
      bodySize = 20;
      nameSize = 36;
      sectionTitleSize = 22;
      itemTitleSize = 20;
      metaSize = 18;
    } else if (config.fontSize === "lg") {
      bodySize = 24;
      nameSize = 46;
      sectionTitleSize = 26;
      itemTitleSize = 24;
      metaSize = 21;
    }

    // Spacing (twips)
    let sectionBeforeSpace = 240;
    let sectionAfterSpace = 120;
    let itemAfterSpace = 100;

    if (config.spacing === "compact") {
      sectionBeforeSpace = 160;
      sectionAfterSpace = 80;
      itemAfterSpace = 60;
    } else if (config.spacing === "spacious") {
      sectionBeforeSpace = 320;
      sectionAfterSpace = 160;
      itemAfterSpace = 140;
    }

    // Page setup
    const isA4 = config.pageSize === "a4";
    const pageWidth = isA4
      ? convertMillimetersToTwip(210)
      : convertInchesToTwip(8.5);
    const pageHeight = isA4
      ? convertMillimetersToTwip(297)
      : convertInchesToTwip(11);

    const marginTwip =
      config.margins === "compact"
        ? convertInchesToTwip(0.5)
        : config.margins === "relaxed"
          ? convertInchesToTwip(1.0)
          : convertInchesToTwip(0.75);

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

    const children: Paragraph[] = [];

    // Helper: Create Section Heading Paragraph
    const createSectionHeading = (text: string): Paragraph => {
      const isClassic = canonicalTemplate === "classic";
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: isClassic ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: sectionBeforeSpace, after: sectionAfterSpace },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 6,
            color: accentHex,
          },
        },
        children: [
          new TextRun({
            text: text.toUpperCase(),
            bold: true,
            font: fontName,
            size: sectionTitleSize,
            color: isClassic ? "111827" : accentHex,
            allCaps: true,
          }),
        ],
      });
    };

    // Header
    const isClassic = canonicalTemplate === "classic";
    children.push(
      new Paragraph({
        alignment: isClassic ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 0, after: 80 },
        children: [
          new TextRun({
            text: personalInfo.fullName || title || "Resume",
            bold: true,
            font: fontName,
            size: nameSize,
            color: "0F172A",
          }),
        ],
      }),
    );

    if (personalInfo.headline) {
      children.push(
        new Paragraph({
          alignment: isClassic ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { before: 0, after: 80 },
          children: [
            new TextRun({
              text: personalInfo.headline,
              bold: true,
              italics: isClassic,
              font: fontName,
              size: bodySize,
              color: accentHex,
            }),
          ],
        }),
      );
    }

    // Contact line
    const contactRuns: (TextRun | ExternalHyperlink)[] = [];
    const addContactItem = (text: string, url?: string | null) => {
      if (contactRuns.length > 0) {
        contactRuns.push(
          new TextRun({
            text: isClassic ? "  •  " : "  |  ",
            color: "94A3B8",
            font: fontName,
            size: metaSize,
          }),
        );
      }
      const safeLink = getSafeUrl(url);
      if (safeLink) {
        contactRuns.push(
          new ExternalHyperlink({
            children: [
              new TextRun({
                text,
                font: fontName,
                size: metaSize,
                color: accentHex,
                underline: {},
              }),
            ],
            link: safeLink,
          }),
        );
      } else {
        contactRuns.push(
          new TextRun({
            text,
            font: fontName,
            size: metaSize,
            color: "475569",
          }),
        );
      }
    };

    if (personalInfo.email)
      addContactItem(personalInfo.email, `mailto:${personalInfo.email}`);
    if (personalInfo.phone) addContactItem(personalInfo.phone);
    if (personalInfo.location) addContactItem(personalInfo.location);
    if (personalInfo.website) addContactItem("Website", personalInfo.website);
    if (personalInfo.linkedin)
      addContactItem("LinkedIn", personalInfo.linkedin);
    if (personalInfo.github) addContactItem("GitHub", personalInfo.github);

    if (contactRuns.length > 0) {
      children.push(
        new Paragraph({
          alignment: isClassic ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { before: 0, after: sectionAfterSpace },
          children: contactRuns,
        }),
      );
    }

    // Section Renderers
    const renderSummary = () => {
      if (!sectionVisibility.showSummary || !summary?.trim()) return;
      children.push(
        createSectionHeading(
          canonicalTemplate === "classic"
            ? "Summary"
            : canonicalTemplate === "executive"
              ? "Executive Summary"
              : "Professional Summary",
        ),
      );
      children.push(
        new Paragraph({
          spacing: { before: 40, after: itemAfterSpace },
          children: [
            new TextRun({
              text: summary,
              font: fontName,
              size: bodySize,
              color: "334155",
            }),
          ],
        }),
      );
    };

    const renderExperience = () => {
      if (!sectionVisibility.showExperience || experience.length === 0) return;
      children.push(
        createSectionHeading(
          canonicalTemplate === "classic"
            ? "Professional Experience"
            : "Work Experience",
        ),
      );

      for (const exp of experience) {
        const titleText = exp.position || exp.jobTitle || "Role";
        const dateRange = `${exp.startDate || ""} – ${exp.current ? "Present" : exp.endDate || "Present"}`;

        children.push(
          new Paragraph({
            spacing: { before: 80, after: 20 },
            children: [
              new TextRun({
                text: titleText,
                bold: true,
                font: fontName,
                size: itemTitleSize,
                color: "0F172A",
              }),
              new TextRun({
                text: ` • ${exp.company || ""}`,
                font: fontName,
                size: itemTitleSize,
                color: "334155",
              }),
              new TextRun({
                text: `\t${dateRange}${exp.location ? ` | ${exp.location}` : ""}`,
                font: fontName,
                size: metaSize,
                color: "64748B",
                italics: isClassic,
              }),
            ],
          }),
        );

        const bullets =
          exp.bullets && exp.bullets.length > 0 ? exp.bullets : [];
        for (const bullet of bullets) {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { before: 20, after: 20 },
              children: [
                new TextRun({
                  text: bullet,
                  font: fontName,
                  size: bodySize,
                  color: "334155",
                }),
              ],
            }),
          );
        }
      }
    };

    const renderEducation = () => {
      if (!sectionVisibility.showEducation || education.length === 0) return;
      children.push(createSectionHeading("Education"));

      for (const edu of education) {
        const degree = `${edu.degree || ""}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ""}`;
        const dateRange = `${edu.startDate || ""}${edu.startDate ? " – " : ""}${edu.current ? "Present" : edu.endDate || ""}`;

        children.push(
          new Paragraph({
            spacing: { before: 80, after: 20 },
            children: [
              new TextRun({
                text: degree,
                bold: true,
                font: fontName,
                size: itemTitleSize,
                color: "0F172A",
              }),
              new TextRun({
                text: `\t${dateRange}`,
                font: fontName,
                size: metaSize,
                color: "64748B",
                italics: isClassic,
              }),
            ],
          }),
        );

        const eduDetails = [
          edu.institution,
          edu.location,
          edu.gpa ? `GPA: ${edu.gpa}` : null,
          edu.honors && edu.honors.length > 0 ? edu.honors.join(", ") : null,
        ]
          .filter(Boolean)
          .join(" • ");

        if (eduDetails) {
          children.push(
            new Paragraph({
              spacing: { before: 0, after: itemAfterSpace },
              children: [
                new TextRun({
                  text: eduDetails,
                  font: fontName,
                  size: metaSize,
                  color: "475569",
                }),
              ],
            }),
          );
        }
      }
    };

    const renderProjects = () => {
      if (!sectionVisibility.showProjects || projects.length === 0) return;
      children.push(createSectionHeading("Key Projects"));

      for (const proj of projects) {
        const projRuns: (TextRun | ExternalHyperlink)[] = [
          new TextRun({
            text: proj.name || "Project",
            bold: true,
            font: fontName,
            size: itemTitleSize,
            color: "0F172A",
          }),
        ];

        if (proj.role) {
          projRuns.push(
            new TextRun({
              text: ` (${proj.role})`,
              font: fontName,
              size: metaSize,
              color: "64748B",
            }),
          );
        }

        const safeUrl = getSafeUrl(proj.url);
        if (safeUrl) {
          projRuns.push(
            new TextRun({
              text: "\t",
            }),
            new ExternalHyperlink({
              children: [
                new TextRun({
                  text: "Link ↗",
                  font: fontName,
                  size: metaSize,
                  color: accentHex,
                  underline: {},
                }),
              ],
              link: safeUrl,
            }),
          );
        }

        children.push(
          new Paragraph({
            spacing: { before: 80, after: 20 },
            children: projRuns,
          }),
        );

        if (proj.description) {
          children.push(
            new Paragraph({
              spacing: { before: 20, after: 20 },
              children: [
                new TextRun({
                  text: proj.description,
                  font: fontName,
                  size: bodySize,
                  color: "334155",
                }),
              ],
            }),
          );
        }

        if (proj.technologies && proj.technologies.length > 0) {
          children.push(
            new Paragraph({
              spacing: { before: 10, after: 20 },
              children: [
                new TextRun({
                  text: `Technologies: ${proj.technologies.join(", ")}`,
                  font: fontName,
                  size: metaSize,
                  color: "64748B",
                  italics: true,
                }),
              ],
            }),
          );
        }

        const bullets =
          proj.bullets && proj.bullets.length > 0
            ? proj.bullets
            : proj.highlights || [];
        for (const bullet of bullets) {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { before: 20, after: 20 },
              children: [
                new TextRun({
                  text: bullet,
                  font: fontName,
                  size: bodySize,
                  color: "334155",
                }),
              ],
            }),
          );
        }
      }
    };

    const renderSkills = () => {
      if (!sectionVisibility.showSkills || skills.length === 0) return;
      children.push(createSectionHeading("Skills & Competencies"));

      for (const skillGroup of skills) {
        children.push(
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({
                text: `${skillGroup.category}: `,
                bold: true,
                font: fontName,
                size: bodySize,
                color: "0F172A",
              }),
              new TextRun({
                text: skillGroup.skills.join(isClassic ? ", " : "  •  "),
                font: fontName,
                size: bodySize,
                color: "334155",
              }),
            ],
          }),
        );
      }
    };

    const renderCertifications = () => {
      if (!sectionVisibility.showCertifications || certifications.length === 0)
        return;
      children.push(createSectionHeading("Certifications"));

      for (const cert of certifications) {
        children.push(
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({
                text: cert.name,
                bold: true,
                font: fontName,
                size: bodySize,
                color: "0F172A",
              }),
              new TextRun({
                text: ` — ${cert.issuer}`,
                font: fontName,
                size: bodySize,
                color: "475569",
              }),
              ...(cert.issueDate
                ? [
                    new TextRun({
                      text: `\t${cert.issueDate}`,
                      font: fontName,
                      size: metaSize,
                      color: "64748B",
                    }),
                  ]
                : []),
            ],
          }),
        );
      }
    };

    const renderAchievements = () => {
      if (!sectionVisibility.showAchievements || achievements.length === 0)
        return;
      children.push(createSectionHeading("Key Achievements"));

      for (const ach of achievements) {
        children.push(
          new Paragraph({
            spacing: { before: 40, after: 20 },
            children: [
              new TextRun({
                text: ach.title,
                bold: true,
                font: fontName,
                size: bodySize,
                color: "0F172A",
              }),
              ...(ach.date
                ? [
                    new TextRun({
                      text: `\t${ach.date}`,
                      font: fontName,
                      size: metaSize,
                      color: "64748B",
                    }),
                  ]
                : []),
            ],
          }),
        );
        if (ach.description) {
          children.push(
            new Paragraph({
              spacing: { before: 0, after: 40 },
              children: [
                new TextRun({
                  text: ach.description,
                  font: fontName,
                  size: bodySize,
                  color: "475569",
                }),
              ],
            }),
          );
        }
      }
    };

    const renderLanguages = () => {
      if (!sectionVisibility.showLanguages || languages.length === 0) return;
      children.push(createSectionHeading("Languages"));

      const langsText = languages
        .map(
          (l) => `${l.language}${l.proficiency ? ` (${l.proficiency})` : ""}`,
        )
        .join("  •  ");

      children.push(
        new Paragraph({
          spacing: { before: 40, after: itemAfterSpace },
          children: [
            new TextRun({
              text: langsText,
              font: fontName,
              size: bodySize,
              color: "334155",
            }),
          ],
        }),
      );
    };

    const renderLinks = () => {
      if (!sectionVisibility.showLinks || links.length === 0) return;
      children.push(createSectionHeading("Additional Links"));

      const linkRuns: (TextRun | ExternalHyperlink)[] = [];
      for (const link of links) {
        if (linkRuns.length > 0) {
          linkRuns.push(
            new TextRun({
              text: "   |   ",
              font: fontName,
              size: bodySize,
              color: "94A3B8",
            }),
          );
        }
        const safeUrl = getSafeUrl(link.url);
        if (safeUrl) {
          linkRuns.push(
            new ExternalHyperlink({
              children: [
                new TextRun({
                  text: `${link.label || link.url} ↗`,
                  font: fontName,
                  size: bodySize,
                  color: accentHex,
                  underline: {},
                }),
              ],
              link: safeUrl,
            }),
          );
        } else {
          linkRuns.push(
            new TextRun({
              text: link.label || link.url,
              font: fontName,
              size: bodySize,
              color: "334155",
            }),
          );
        }
      }

      children.push(
        new Paragraph({
          spacing: { before: 40, after: itemAfterSpace },
          children: linkRuns,
        }),
      );
    };

    const sectionRenderers: Record<string, () => void> = {
      summary: renderSummary,
      experience: renderExperience,
      education: renderEducation,
      projects: renderProjects,
      skills: renderSkills,
      certifications: renderCertifications,
      achievements: renderAchievements,
      languages: renderLanguages,
      links: renderLinks,
    };

    // Render in configured sectionOrder
    for (const secKey of sectionOrder) {
      if (sectionRenderers[secKey]) {
        sectionRenderers[secKey]();
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: {
                width: pageWidth,
                height: pageHeight,
              },
              margin: {
                top: marginTwip,
                bottom: marginTwip,
                left: marginTwip,
                right: marginTwip,
              },
            },
          },
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = sanitizeFilename(title || personalInfo.fullName, "docx");

    return {
      buffer,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filename,
    };
  }
}

export const docxResumeExporter = new DocxResumeExporter();
