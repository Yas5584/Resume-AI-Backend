import { describe, it, expect } from "vitest";
import {
  TemplateIdSchema,
  FontFamilySchema,
  FontSizeSchema,
  AccentColorSchema,
  SpacingSchema,
  MarginsSchema,
  PageSizeSchema,
  TemplateConfigSchema,
  getDefaultTemplateConfig,
  normalizeTemplateId,
  COLOR_PALETTES,
  CANONICAL_TEMPLATE_IDS,
} from "../src/schemas/template.schema.js";
import { UpdateResumeDesignRequestSchema } from "../src/schemas/api.schema.js";

describe("Resume Template & Design Schemas (Phase 3)", () => {
  describe("TemplateIdSchema", () => {
    it("should accept valid canonical template IDs", () => {
      for (const id of CANONICAL_TEMPLATE_IDS) {
        expect(TemplateIdSchema.parse(id)).toBe(id);
      }
    });

    it("should accept legacy modern-standard template ID", () => {
      expect(TemplateIdSchema.parse("modern-standard")).toBe("modern-standard");
    });

    it("should reject invalid template IDs and script injections", () => {
      expect(() => TemplateIdSchema.parse("fancy")).toThrow();
      expect(() => TemplateIdSchema.parse("custom")).toThrow();
      expect(() =>
        TemplateIdSchema.parse("<script>alert(1)</script>"),
      ).toThrow();
      expect(() => TemplateIdSchema.parse("")).toThrow();
    });
  });

  describe("FontFamilySchema", () => {
    it("should accept allowlisted fonts", () => {
      const allowed = [
        "Inter",
        "Arial",
        "Helvetica",
        "Georgia",
        "Times New Roman",
      ];
      for (const font of allowed) {
        expect(FontFamilySchema.parse(font)).toBe(font);
      }
    });

    it("should reject unallowed fonts and CSS injections", () => {
      expect(() => FontFamilySchema.parse("Comic Sans")).toThrow();
      expect(() => FontFamilySchema.parse("Roboto")).toThrow();
      expect(() =>
        FontFamilySchema.parse("url(http://evil.com/font.ttf)"),
      ).toThrow();
      expect(() => FontFamilySchema.parse("Inter; font-size: 50px")).toThrow();
    });
  });

  describe("FontSizeSchema", () => {
    it("should accept sm, md, lg", () => {
      expect(FontSizeSchema.parse("sm")).toBe("sm");
      expect(FontSizeSchema.parse("md")).toBe("md");
      expect(FontSizeSchema.parse("lg")).toBe("lg");
    });

    it("should reject arbitrary font sizes", () => {
      expect(() => FontSizeSchema.parse("xl")).toThrow();
      expect(() => FontSizeSchema.parse("14px")).toThrow();
      expect(() => FontSizeSchema.parse("small")).toThrow();
    });
  });

  describe("AccentColorSchema", () => {
    it("should accept allowlisted contrast-safe accent colors", () => {
      const colors = [
        "slate",
        "navy",
        "blue",
        "emerald",
        "burgundy",
        "charcoal",
      ];
      for (const color of colors) {
        expect(AccentColorSchema.parse(color)).toBe(color);
      }
    });

    it("should reject arbitrary colors and hex strings", () => {
      expect(() => AccentColorSchema.parse("#ff0000")).toThrow();
      expect(() => AccentColorSchema.parse("red")).toThrow();
      expect(() => AccentColorSchema.parse("rgb(0,0,0)")).toThrow();
      expect(() => AccentColorSchema.parse("javascript:alert(1)")).toThrow();
    });
  });

  describe("SpacingSchema & MarginsSchema & PageSizeSchema", () => {
    it("should validate spacing scales", () => {
      expect(SpacingSchema.parse("compact")).toBe("compact");
      expect(SpacingSchema.parse("comfortable")).toBe("comfortable");
      expect(SpacingSchema.parse("spacious")).toBe("spacious");
      expect(() => SpacingSchema.parse("huge")).toThrow();
    });

    it("should validate margin scales", () => {
      expect(MarginsSchema.parse("compact")).toBe("compact");
      expect(MarginsSchema.parse("normal")).toBe("normal");
      expect(MarginsSchema.parse("relaxed")).toBe("relaxed");
      expect(() => MarginsSchema.parse("zero")).toThrow();
    });

    it("should validate page sizes", () => {
      expect(PageSizeSchema.parse("a4")).toBe("a4");
      expect(PageSizeSchema.parse("letter")).toBe("letter");
      expect(() => PageSizeSchema.parse("legal")).toThrow();
      expect(() => PageSizeSchema.parse("tabloid")).toThrow();
    });
  });

  describe("TemplateConfigSchema", () => {
    it("should initialize with sensible defaults when empty object is passed", () => {
      const config = TemplateConfigSchema.parse({});
      expect(config.templateId).toBe("modern");
      expect(config.fontFamily).toBe("Inter");
      expect(config.fontSize).toBe("md");
      expect(config.accentColor).toBe("blue");
      expect(config.spacing).toBe("comfortable");
      expect(config.margins).toBe("normal");
      expect(config.pageSize).toBe("a4");
    });

    it("should accept valid overrides", () => {
      const config = TemplateConfigSchema.parse({
        templateId: "classic",
        fontFamily: "Georgia",
        fontSize: "lg",
        accentColor: "burgundy",
        spacing: "spacious",
        margins: "relaxed",
        pageSize: "letter",
      });
      expect(config.templateId).toBe("classic");
      expect(config.fontFamily).toBe("Georgia");
      expect(config.fontSize).toBe("lg");
      expect(config.accentColor).toBe("burgundy");
      expect(config.spacing).toBe("spacious");
      expect(config.margins).toBe("relaxed");
      expect(config.pageSize).toBe("letter");
    });

    it("should reject invalid values inside config", () => {
      expect(() =>
        TemplateConfigSchema.parse({
          templateId: "invalid",
        }),
      ).toThrow();

      expect(() =>
        TemplateConfigSchema.parse({
          accentColor: "neon-pink",
        }),
      ).toThrow();
    });
  });

  describe("getDefaultTemplateConfig & normalizeTemplateId", () => {
    it("should normalize template identifiers", () => {
      expect(normalizeTemplateId("modern")).toBe("modern");
      expect(normalizeTemplateId("modern-standard")).toBe("modern");
      expect(normalizeTemplateId("classic")).toBe("classic");
      expect(normalizeTemplateId("minimal")).toBe("minimal");
      expect(normalizeTemplateId("executive")).toBe("executive");
      expect(normalizeTemplateId(null)).toBe("modern");
      expect(normalizeTemplateId("unknown")).toBe("modern");
    });

    it("should return correct defaults for each template", () => {
      const modern = getDefaultTemplateConfig("modern");
      expect(modern.templateId).toBe("modern");
      expect(modern.fontFamily).toBe("Inter");
      expect(modern.accentColor).toBe("blue");
      expect(modern.pageSize).toBe("a4");

      const classic = getDefaultTemplateConfig("classic");
      expect(classic.templateId).toBe("classic");
      expect(classic.fontFamily).toBe("Georgia");
      expect(classic.accentColor).toBe("slate");
      expect(classic.pageSize).toBe("letter");

      const minimal = getDefaultTemplateConfig("minimal");
      expect(minimal.templateId).toBe("minimal");
      expect(minimal.fontFamily).toBe("Arial");
      expect(minimal.fontSize).toBe("sm");
      expect(minimal.spacing).toBe("compact");
      expect(minimal.pageSize).toBe("a4");

      const executive = getDefaultTemplateConfig("executive");
      expect(executive.templateId).toBe("executive");
      expect(executive.fontFamily).toBe("Times New Roman");
      expect(executive.accentColor).toBe("navy");
      expect(executive.pageSize).toBe("letter");
    });
  });

  describe("COLOR_PALETTES", () => {
    it("should contain definitions for every AccentColor with valid hex and classes", () => {
      const colors = [
        "slate",
        "navy",
        "blue",
        "emerald",
        "burgundy",
        "charcoal",
      ] as const;

      for (const color of colors) {
        const palette = COLOR_PALETTES[color];
        expect(palette).toBeDefined();
        expect(palette.id).toBe(color);
        expect(palette.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(palette.textClass).toBeDefined();
        expect(palette.bgClass).toBeDefined();
        expect(palette.borderClass).toBeDefined();
      }
    });
  });

  describe("UpdateResumeDesignRequestSchema", () => {
    it("should validate partial design updates", () => {
      const valid1 = UpdateResumeDesignRequestSchema.parse({
        templateId: "minimal",
      });
      expect(valid1.templateId).toBe("minimal");

      const valid2 = UpdateResumeDesignRequestSchema.parse({
        templateConfig: {
          accentColor: "emerald",
        },
      });
      expect(valid2.templateConfig?.accentColor).toBe("emerald");
      // Defaults filled in
      expect(valid2.templateConfig?.fontFamily).toBe("Inter");

      const valid3 = UpdateResumeDesignRequestSchema.parse({});
      expect(valid3).toEqual({});
    });

    it("should reject invalid design payloads", () => {
      expect(() =>
        UpdateResumeDesignRequestSchema.parse({
          templateId: "unsupported-template",
        }),
      ).toThrow();

      expect(() =>
        UpdateResumeDesignRequestSchema.parse({
          templateConfig: {
            fontFamily: "Papyrus",
          },
        }),
      ).toThrow();
    });
  });
});
