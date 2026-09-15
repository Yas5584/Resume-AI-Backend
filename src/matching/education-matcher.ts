import { ResumeData, JobAnalysis } from "@resumeai/shared";

export interface EducationMatchResult {
  score: number; // 0 to 100
  details: string;
  matchedCount: number;
  totalCount: number;
}

const DEGREE_RANK: Record<string, number> = {
  doctorate: 5,
  phd: 5,
  master: 4,
  ms: 4,
  mba: 4,
  bachelor: 3,
  bs: 3,
  ba: 3,
  associate: 2,
  "high school": 1,
};

function getDegreeRank(degreeStr?: string): number {
  if (!degreeStr) return 0;
  const lower = degreeStr.toLowerCase();
  for (const [key, rank] of Object.entries(DEGREE_RANK)) {
    if (lower.includes(key)) return rank;
  }
  return 2; // Default recognized degree
}

export function matchEducation(
  jobAnalysis: JobAnalysis,
  resumeData: ResumeData,
  candidateYearsOfExperience = 0,
): EducationMatchResult {
  const jobEduList = jobAnalysis.education || [];

  if (jobEduList.length === 0) {
    return {
      score: 100,
      details: "No explicit education requirements specified",
      matchedCount: 1,
      totalCount: 1,
    };
  }

  const candidateEduList = resumeData.education || [];
  let highestCandidateRank = 0;
  for (const edu of candidateEduList) {
    const rank = Math.max(
      getDegreeRank(edu.degree),
      getDegreeRank(edu.fieldOfStudy),
    );
    if (rank > highestCandidateRank) {
      highestCandidateRank = rank;
    }
  }

  let totalWeight = 0;
  let earnedWeight = 0;
  let matchedCount = 0;

  for (const eduReq of jobEduList) {
    const isRequired = eduReq.importance === "REQUIRED";
    const weight = isRequired ? 2.0 : 1.0;
    totalWeight += weight;

    const reqRank = getDegreeRank(eduReq.degree || "bachelor");
    const allowsEquivalent = (eduReq.evidence || eduReq.degree || "")
      .toLowerCase()
      .includes("equivalent");

    if (highestCandidateRank >= reqRank) {
      earnedWeight += weight;
      matchedCount++;
    } else if (allowsEquivalent && candidateYearsOfExperience >= 3) {
      // Satisfied by equivalent professional experience
      earnedWeight += weight;
      matchedCount++;
    } else if (highestCandidateRank > 0) {
      // Partial education match
      earnedWeight += weight * 0.6;
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
    details:
      highestCandidateRank > 0
        ? `Candidate holds recognized academic credentials meeting ${matchedCount} of ${jobEduList.length} criteria`
        : "No post-secondary degree found in resume",
    matchedCount,
    totalCount: jobEduList.length,
  };
}
