import { ResumeData, JobAnalysis } from "@resumeai/shared";

export interface CertificationMatchResult {
  score: number; // 0 to 100
  details: string;
  matchedCount: number;
  totalCount: number;
}

export function matchCertifications(
  jobAnalysis: JobAnalysis,
  resumeData: ResumeData,
): CertificationMatchResult {
  const jobCerts = jobAnalysis.certifications || [];

  if (jobCerts.length === 0) {
    return {
      score: 100,
      details: "No explicit certifications required",
      matchedCount: 0,
      totalCount: 0,
    };
  }

  const candidateCerts = (resumeData.certifications || []).map((c) =>
    (c.name || "").toLowerCase(),
  );

  let matchedCount = 0;
  let totalWeight = 0;
  let earnedWeight = 0;

  for (const certReq of jobCerts) {
    const isRequired = certReq.importance === "REQUIRED";
    const weight = isRequired ? 2.0 : 1.0;
    totalWeight += weight;

    const reqName = certReq.name.toLowerCase();
    const isMatched = candidateCerts.some(
      (c) => c.includes(reqName) || reqName.includes(c),
    );

    if (isMatched) {
      matchedCount++;
      earnedWeight += weight;
    }
  }

  const score =
    totalWeight > 0
      ? Math.min(
          100,
          Math.max(0, Math.round((earnedWeight / totalWeight) * 100)),
        )
      : 100;

  return {
    score,
    details: `Matched ${matchedCount} of ${jobCerts.length} specified certifications`,
    matchedCount,
    totalCount: jobCerts.length,
  };
}
