import { describe, it, expect } from "vitest";
import { verifySingleChange } from "../src/ai/fact-guard/fact-guard-engine.js";
import type { ResumeData, ResumeContentChange } from "@resumeai/shared";

const resumeData: ResumeData = {
  personalInfo: { fullName: "Test User", headline: "Software Engineer" },
  summary: "Backend engineer.",
  experience: [
    {
      id: "exp1",
      company: "Acme",
      jobTitle: "Software Engineer",
      startDate: "2022-01",
      endDate: "2024-01",
      bullets: ["Processed 10K+ records with 92% accuracy"],
      technologiesUsed: ["Python", "FastAPI", "PostgreSQL", "Docker"],
    },
  ],
  projects: [],
  skills: [
    {
      id: "skill1",
      category: "Languages",
      skills: ["Python", "JavaScript", "SQL"],
    },
    {
      id: "skill2",
      category: "Frameworks",
      skills: ["FastAPI", "Node.js", "Express.js", "React"],
    },
    {
      id: "skill3",
      category: "Databases",
      skills: ["PostgreSQL", "MongoDB"],
    },
  ],
  education: [],
  certifications: [],
} as unknown as ResumeData;

function makeChange(proposedValue: string): ResumeContentChange {
  return {
    id: "c1",
    section: "summary",
    itemId: "summary",
    field: "summary",
    originalValue: "Backend engineer with Python experience.",
    proposedValue,
    changeType: "REWRITE",
    targetRequirementIds: [],
    evidenceIds: ["summary"],
    rationale: "test",
    risk: "LOW",
    status: "PENDING",
    factCheckStatus: "PENDING" as never,
  } as unknown as ResumeContentChange;
}

describe("Fact Guard repro", () => {
  it("A. Django absent -> UNSUPPORTED + BLOCKED", () => {
    const r = verifySingleChange(
      makeChange(
        "Engineer skilled in Python and Django, building APIs with FastAPI.",
      ),
      resumeData,
    );
    console.log(
      "DJANGO:",
      r.factGuardScore,
      r.verifiedChange.factCheckStatus,
      r.verifiedChange.status,
      JSON.stringify(r.claims, null, 1),
    );
    expect(r.verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(r.verifiedChange.status).toBe("BLOCKED");
  });

  it("B. 10K+ records -> over 10K users -> BLOCKED", () => {
    const r = verifySingleChange(
      makeChange(
        "Backend engineer supporting over 10K users, processing 10K+ records.",
      ),
      resumeData,
    );
    console.log(
      "10K USERS:",
      r.factGuardScore,
      r.verifiedChange.factCheckStatus,
      r.verifiedChange.status,
      JSON.stringify(r.claims, null, 1),
    );
    expect(["UNSUPPORTED", "CONTRADICTED"]).toContain(
      r.verifiedChange.factCheckStatus,
    );
    expect(r.verifiedChange.status).toBe("BLOCKED");
  });

  it("C. scalable, data-driven products -> BLOCKED", () => {
    const r = verifySingleChange(
      makeChange(
        "Driving scalable, data-driven product innovation with Python.",
      ),
      resumeData,
    );
    console.log(
      "SCALABLE:",
      r.factGuardScore,
      r.verifiedChange.factCheckStatus,
      r.verifiedChange.status,
      JSON.stringify(r.claims, null, 1),
    );
    expect(r.verifiedChange.status).toBe("BLOCKED");
  });

  it("H. 10K+ records preserved -> SUPPORTED", () => {
    const r = verifySingleChange(
      makeChange("Processed 10K+ records with 92% accuracy using Python."),
      resumeData,
    );
    console.log(
      "10K RECORDS:",
      r.factGuardScore,
      r.verifiedChange.factCheckStatus,
      r.verifiedChange.status,
      JSON.stringify(r.claims, null, 1),
    );
    expect(r.verifiedChange.factCheckStatus).toBe("SUPPORTED");
  });

  it("I. FastAPI -> SUPPORTED", () => {
    const r = verifySingleChange(
      makeChange("Built REST APIs with FastAPI and PostgreSQL."),
      resumeData,
    );
    console.log(
      "FASTAPI:",
      r.factGuardScore,
      r.verifiedChange.factCheckStatus,
      r.verifiedChange.status,
      JSON.stringify(r.claims, null, 1),
    );
    expect(r.verifiedChange.factCheckStatus).toBe("SUPPORTED");
  });
});
