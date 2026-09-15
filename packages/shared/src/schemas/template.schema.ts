import { z } from "zod";

/**
 * Allowlisted Template Identifiers.
 * Includes "modern-standard" as an alias for "modern" to preserve backwards compatibility with Phase 0-2 data.
 */
export const TemplateIdSchema = z.enum([
  "modern",
  "classic",
  "minimal",
  "executive",
  "modern-standard",
]);

export type TemplateId = z.infer<typeof TemplateIdSchema>;

export const CANONICAL_TEMPLATE_IDS = [
  "modern",
  "classic",
  "minimal",
  "executive",
] as const;

export type CanonicalTemplateId = (typeof CANONICAL_TEMPLATE_IDS)[number];

/**
 * Allowlisted Typography / Font Families.
 * Web-safe and standard modern fonts.
 */
export const FontFamilySchema = z.enum([
  "Inter",
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
]);

export type FontFamily = z.infer<typeof FontFamilySchema>;

/**
 * Allowlisted Font Size scales.
 */
export const FontSizeSchema = z.enum(["sm", "md", "lg"]);

export type FontSize = z.infer<typeof FontSizeSchema>;

/**
 * Allowlisted Accent Color options.
 * Curated, accessible, contrast-compliant colors.
 */
export const AccentColorSchema = z.enum([
  "slate",
  "navy",
  "blue",
  "emerald",
  "burgundy",
  "charcoal",
]);

export type AccentColor = z.infer<typeof AccentColorSchema>;

/**
 * Allowlisted Spacing scales.
 */
export const SpacingSchema = z.enum(["compact", "comfortable", "spacious"]);

export type Spacing = z.infer<typeof SpacingSchema>;

/**
 * Allowlisted Margin scales.
 */
export const MarginsSchema = z.enum(["compact", "normal", "relaxed"]);

export type Margins = z.infer<typeof MarginsSchema>;

/**
 * Allowlisted Page Size scales.
 */
export const PageSizeSchema = z.enum(["a4", "letter"]);

export type PageSize = z.infer<typeof PageSizeSchema>;

/**
 * Complete Template Configuration Schema.
 * Presentation configuration strictly decoupled from ResumeData content.
 */
export const TemplateConfigSchema = z.object({
  templateId: TemplateIdSchema.default("modern"),
  fontFamily: FontFamilySchema.default("Inter"),
  fontSize: FontSizeSchema.default("md"),
  accentColor: AccentColorSchema.default("blue"),
  spacing: SpacingSchema.default("comfortable"),
  margins: MarginsSchema.default("normal"),
  pageSize: PageSizeSchema.default("a4"),
});

export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;

/**
 * Color Palette metadata and hex/Tailwind definitions.
 */
export interface ColorPaletteDefinition {
  id: AccentColor;
  name: string;
  hex: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
}

export const COLOR_PALETTES: Record<AccentColor, ColorPaletteDefinition> = {
  slate: {
    id: "slate",
    name: "Slate",
    hex: "#475569",
    textClass: "text-slate-600",
    bgClass: "bg-slate-600",
    borderClass: "border-slate-600",
  },
  navy: {
    id: "navy",
    name: "Navy",
    hex: "#1e3a8a",
    textClass: "text-blue-900",
    bgClass: "bg-blue-900",
    borderClass: "border-blue-900",
  },
  blue: {
    id: "blue",
    name: "Corporate Blue",
    hex: "#2563eb",
    textClass: "text-blue-600",
    bgClass: "bg-blue-600",
    borderClass: "border-blue-600",
  },
  emerald: {
    id: "emerald",
    name: "Emerald Green",
    hex: "#059669",
    textClass: "text-emerald-600",
    bgClass: "bg-emerald-600",
    borderClass: "border-emerald-600",
  },
  burgundy: {
    id: "burgundy",
    name: "Burgundy",
    hex: "#831843",
    textClass: "text-pink-900",
    bgClass: "bg-pink-900",
    borderClass: "border-pink-900",
  },
  charcoal: {
    id: "charcoal",
    name: "Charcoal",
    hex: "#374151",
    textClass: "text-gray-700",
    bgClass: "bg-gray-700",
    borderClass: "border-gray-700",
  },
};

/**
 * Normalizes any template identifier into a canonical template ID.
 */
export function normalizeTemplateId(id?: string | null): CanonicalTemplateId {
  if (!id || id === "modern-standard" || id === "modern") return "modern";
  if (id === "classic") return "classic";
  if (id === "minimal") return "minimal";
  if (id === "executive") return "executive";
  return "modern";
}

/**
 * Returns default template configuration for a given template.
 */
export function getDefaultTemplateConfig(
  templateId?: string | null,
): TemplateConfig {
  const canonical = normalizeTemplateId(templateId);
  switch (canonical) {
    case "classic":
      return {
        templateId: "classic",
        fontFamily: "Georgia",
        fontSize: "md",
        accentColor: "slate",
        spacing: "comfortable",
        margins: "normal",
        pageSize: "letter",
      };
    case "minimal":
      return {
        templateId: "minimal",
        fontFamily: "Arial",
        fontSize: "sm",
        accentColor: "charcoal",
        spacing: "compact",
        margins: "compact",
        pageSize: "a4",
      };
    case "executive":
      return {
        templateId: "executive",
        fontFamily: "Times New Roman",
        fontSize: "md",
        accentColor: "navy",
        spacing: "comfortable",
        margins: "normal",
        pageSize: "letter",
      };
    case "modern":
    default:
      return {
        templateId: "modern",
        fontFamily: "Inter",
        fontSize: "md",
        accentColor: "blue",
        spacing: "comfortable",
        margins: "normal",
        pageSize: "a4",
      };
  }
}
