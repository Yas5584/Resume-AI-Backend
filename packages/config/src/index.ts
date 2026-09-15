export const APP_CONFIG = {
  name: "ResumeAI",
  version: "0.1.0",
  description:
    "AI-Powered Production Resume Tailoring & ATS Optimization Platform",
  defaultAiModel: "gpt-4o",
  fastAiModel: "gpt-4o-mini",
  apiPrefix: "/api",
} as const;

export type AppConfig = typeof APP_CONFIG;
