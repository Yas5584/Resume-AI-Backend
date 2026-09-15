import { describe, it, expect } from "vitest";
import { verifySingleChange } from "../src/ai/fact-guard/fact-guard-engine.js";
import type { ResumeData, ResumeContentChange } from "@resumeai/shared";

// Authoritative resume evidence — matches the user's real resume shape:
// Python/JS/Node/Express/FastAPI/React/PostgreSQL/MongoDB/SQL stack,
// "10K+ records", "92% accuracy", Docker. No Django, no PySpark,
// no Kubernetes, no users metric, no scalability language.
const resumeData: ResumeData = {
  personalInfo: { fullName: "Test User", headline: "Software Engineer" },
  summary: "Backend engineer.",
  experience: [
    {
      id: "exp1",
      company: "Acme Corp",
      jobTitle: "Software Engineer",
      startDate: "2022-01",
      endDate: "2024-01",
      bullets: [
        "Built REST APIs handling 10K+ records with 92% accuracy using Python and FastAPI",
        "Containerized services with Docker",
      ],
      technologiesUsed: [
        "Python",
        "FastAPI",
        "PostgreSQL",
        "Docker",
        "Node.js",
      ],
    },
  ],
  projects: [
    {
      id: "proj1",
      name: "Data Pipeline",
      description: "ETL pipeline processing 10K+ records",
      technologies: ["Python", "PostgreSQL"],
      bullets: [],
    },
  ],
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
    { id: "skill3", category: "Databases", skills: ["PostgreSQL", "MongoDB"] },
    {
      id: "skill4",
      category: "ML",
      skills: ["Scikit-learn", "TensorFlow", "LangChain"],
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

describe("Fact Guard regression suite", () => {
  it("A. Django absent -> UNSUPPORTED + BLOCKED", () => {
    const r = verifySingleChange(
      makeChange(
        "Engineer skilled in Python and Django, building APIs with FastAPI.",
      ),
      resumeData,
    );
    expect(
      r.claims.some(
        (c) => /django/i.test(c.claim) && c.factCheckStatus === "UNSUPPORTED",
      ),
    ).toBe(true);
    expect(r.verifiedChange.factCheckStatus).toBe("UNSUPPORTED");
    expect(r.verifiedChange.status).toBe("BLOCKED");
    expect(r.factGuardScore).toBeLessThan(100);
  });

  it("B. '10K+ records' -> '10K+ users' -> CONTRADICTED + BLOCKED", () => {
    const r = verifySingleChange(
      makeChange("Backend engineer supporting over 10K users."),
      resumeData,
    );
    expect(["UNSUPPORTED", "CONTRADICTED"]).toContain(
      r.verifiedChange.factCheckStatus,
    );
    expect(r.verifiedChange.status).toBe("BLOCKED");
    expect(r.factGuardScore).toBeLessThan(100);
  });

  it("C. REST APIs -> microservices -> BLOCKED (no explicit evidence)", () => {
    const r = verifySingleChange(
      makeChange("Architected microservices with Python and REST APIs."),
      resumeData,
    );
    expect(r.verifiedChange.status).toBe("BLOCKED");
    expect(r.factGuardScore).toBeLessThan(100);
  });

  it("D. backend -> scalable architecture -> BLOCKED (no explicit evidence)", () => {
    const r = verifySingleChange(
      makeChange("Backend engineer driving scalable architecture with Python."),
      resumeData,
    );
    expect(r.verifiedChange.status).toBe("BLOCKED");
    expect(r.factGuardScore).toBeLessThan(100);
  });

  it("E. Docker -> Kubernetes -> BLOCKED", () => {
    const r = verifySingleChange(
      makeChange("Orchestrated containers with Kubernetes and Docker."),
      resumeData,
    );
    expect(r.verifiedChange.status).toBe("BLOCKED");
    expect(r.factGuardScore).toBeLessThan(100);
  });

  it("F. Python -> PySpark -> BLOCKED", () => {
    const r = verifySingleChange(
      makeChange("Big data processing with PySpark and Python."),
      resumeData,
    );
    expect(r.verifiedChange.status).toBe("BLOCKED");
    expect(r.factGuardScore).toBeLessThan(100);
  });

  it("G. 92% -> 98% -> CONTRADICTED + BLOCKED", () => {
    const r = verifySingleChange(
      makeChange("Achieved 98% accuracy with 10K+ records."),
      resumeData,
    );
    expect(r.verifiedChange.factCheckStatus).toBe("CONTRADICTED");
    expect(r.verifiedChange.status).toBe("BLOCKED");
    expect(r.factGuardScore).toBeLessThan(100);
  });

  it("G2. '92% accuracy' vs resume '92% prediction accuracy' -> SUPPORTED (no false contradiction)", () => {
    const r = verifySingleChange(
      makeChange(
        "Built a predictive model achieving 92% accuracy on 10K+ records.",
      ),
      resumeData,
    );
    expect(r.verifiedChange.factCheckStatus).not.toBe("CONTRADICTED");
    expect(r.verifiedChange.status).not.toBe("BLOCKED");
  });

  it("H. 10K+ records preserved -> SUPPORTED", () => {
    const r = verifySingleChange(
      makeChange(
        "Built REST APIs handling 10K+ records with Python and FastAPI.",
      ),
      resumeData,
    );
    expect(r.verifiedChange.factCheckStatus).toBe("SUPPORTED");
    expect(r.verifiedChange.status).not.toBe("BLOCKED");
    expect(r.factGuardScore).toBe(100);
  });

  it("I. FastAPI preserved -> SUPPORTED", () => {
    const r = verifySingleChange(
      makeChange("Built REST APIs with FastAPI and PostgreSQL."),
      resumeData,
    );
    expect(r.verifiedChange.factCheckStatus).toBe("SUPPORTED");
    expect(r.factGuardScore).toBe(100);
  });

  it("J. all claims supported -> Fact Guard = 100%", () => {
    const r = verifySingleChange(
      makeChange(
        "Software engineer building REST APIs with Python, FastAPI, Node.js, Express.js and React, backed by PostgreSQL and MongoDB, processing 10K+ records with 92% accuracy.",
      ),
      resumeData,
    );
    expect(r.factGuardScore).toBe(100);
    expect(r.unsupportedClaimsCount).toBe(0);
    expect(r.verifiedChange.status).not.toBe("BLOCKED");
  });

  it("K. one unsupported claim -> Fact Guard < 100%", () => {
    const r = verifySingleChange(
      makeChange(
        "Software engineer building REST APIs with Python, FastAPI, Node.js and React, backed by PostgreSQL, processing 10K+ records with 92% accuracy, plus Django services.",
      ),
      resumeData,
    );
    expect(r.factGuardScore).toBeLessThan(100);
    expect(r.unsupportedClaimsCount).toBeGreaterThan(0);
    expect(r.verifiedChange.status).toBe("BLOCKED");
  });

  it("ADVERSARIAL: Django/AWS/K8s/PySpark/scalable/10K users/98% all detected", () => {
    const r = verifySingleChange(
      makeChange(
        "Software Developer experienced with Django, AWS, Kubernetes and PySpark, building scalable microservices that serve over 10K users with 98% accuracy.",
      ),
      resumeData,
    );
    console.log(
      "ADVERSARIAL claims:",
      JSON.stringify(
        r.claims.map((c) => ({ claim: c.claim, s: c.factCheckStatus })),
        null,
        1,
      ),
    );
    const bad = r.claims.filter((c) => c.factCheckStatus !== "SUPPORTED");
    expect(bad.length).toBeGreaterThanOrEqual(7);
    expect(r.verifiedChange.status).toBe("BLOCKED");
    expect(r.factGuardScore).toBeLessThan(100);
  });

  it("Missing evidenceIds -> BLOCKED, score 0", () => {
    const change = {
      ...makeChange("Some rewrite."),
      evidenceIds: [],
    } as ResumeContentChange;
    const r = verifySingleChange(change, resumeData);
    expect(r.verifiedChange.status).toBe("BLOCKED");
    expect(r.factGuardScore).toBe(0);
  });

  it("Forged evidenceId -> INVALID EVIDENCE, BLOCKED", () => {
    const change = {
      ...makeChange("Some rewrite."),
      evidenceIds: ["evidence_made_up_by_llm"],
    } as ResumeContentChange;
    const r = verifySingleChange(change, resumeData);
    expect(r.verifiedChange.status).toBe("BLOCKED");
    expect(r.factGuardScore).toBe(0);
  });
});
