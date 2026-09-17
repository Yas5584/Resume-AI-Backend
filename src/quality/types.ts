import {
  ResumeQualityFinding,
  ResumeQualityCategoryType,
} from "@resumeai/shared";

export interface DeterministicCheckResult {
  category: ResumeQualityCategoryType;
  findings: ResumeQualityFinding[];
  passedChecksCount: number;
  totalChecksCount: number;
  metrics: Record<string, any>;
}

export interface AllChecksResult {
  findings: ResumeQualityFinding[];
  categoryResults: Record<ResumeQualityCategoryType, DeterministicCheckResult>;
  summaryMetrics: {
    totalWords: number;
    experienceCount: number;
    bulletCount: number;
    quantifiedBulletsCount: number;
    actionVerbBulletsCount: number;
    skillsCount: number;
    educationCount: number;
    hasContactInfo: boolean;
    hasValidEmail: boolean;
    hasValidPhone: boolean;
    hasLocation: boolean;
  };
}
