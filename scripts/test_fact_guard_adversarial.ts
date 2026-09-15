import {
  verifySingleChange,
  isMentionedInText,
} from "../src/ai/fact-guard/fact-guard-engine.js";
import { buildEvidenceMap } from "../src/ai/evidence/evidence-map.js";
import { ResumeData, ResumeContentChange } from "@resumeai/shared";

async function runFactGuardAdversarialTest() {
  console.log("Starting Fact Guard Adversarial Regression Test...\n");

  // Authoritative Resume Data (Does NOT contain Django, Kubernetes, PySpark, microservices, 5,000 users, 98% accuracy, Senior Software Developer)
  const authoritativeResume: ResumeData = {
    personalInfo: {
      fullName: "Priya Sharma",
      title: "Software Developer",
      summary: "Software Developer with experience in Python, FastAPI, React, and PostgreSQL. Built backend APIs handling 10K+ records.",
    },
    experience: [
      {
        id: "exp-1",
        company: "Alpha Tech",
        position: "Software Developer",
        startDate: "2022-01",
        current: true,
        description: "Developed RESTful APIs with Python and FastAPI. Processed 10K+ records daily.",
        highlights: ["Optimized SQL queries by 30%", "Built React frontend dashboards"],
      },
    ],
    skills: [
      {
        id: "skills-1",
        category: "Backend",
        skills: ["Python", "FastAPI", "PostgreSQL", "React", "Docker"],
      },
    ],
  };

  const evidenceMap = buildEvidenceMap(authoritativeResume);

  const adversarialClaims = [
    { claim: "Django", text: "Expert in Django web framework", expectedBlocked: true },
    { claim: "Kubernetes", text: "Orchestrated container clusters with Kubernetes", expectedBlocked: true },
    { claim: "PySpark", text: "Processed big data pipelines with PySpark", expectedBlocked: true },
    { claim: "microservices", text: "Architected distributed microservices architecture", expectedBlocked: true },
    { claim: "5,000 users", text: "Scaled applications supporting over 5,000 users daily", expectedBlocked: true },
    { claim: "98% accuracy", text: "Achieved 98% accuracy on classification models", expectedBlocked: true },
    { claim: "Senior Software Developer", text: "Senior Software Developer with 10 years experience", expectedBlocked: true },
    // Supported facts
    { claim: "Python", text: "Software Developer proficient in Python and FastAPI", expectedBlocked: false },
    { claim: "PostgreSQL", text: "Designed relational database schemas using PostgreSQL", expectedBlocked: false },
    { claim: "Docker", text: "Containerized backend services using Docker", expectedBlocked: false },
  ];

  let passed = 0;
  let failed = 0;

  for (const item of adversarialClaims) {
    const change: ResumeContentChange = {
      id: `change-${item.claim}`,
      section: "summary",
      field: "summary",
      originalValue: authoritativeResume.personalInfo.summary || "",
      proposedValue: item.text,
      changeType: "REWRITE",
      targetRequirementIds: [],
      evidenceIds: ["summary"],
      rationale: "Testing claim",
    };

    const result = verifySingleChange(change, authoritativeResume, evidenceMap);
    const vc = result.verifiedChange;
    const isBlocked =
      vc.status === "BLOCKED" ||
      vc.factCheckStatus === "UNSUPPORTED" ||
      vc.factCheckStatus === "CONTRADICTED" ||
      result.unsupportedClaimsCount > 0;

    if (item.expectedBlocked) {
      if (isBlocked) {
        console.log(
          `[PASS - BLOCKED] "${item.claim}" was correctly flagged (${vc.factCheckStatus || "BLOCKED"}): ${vc.factCheckReasoning || result.reason || "Unsupported claim"}`,
        );
        passed++;
      } else {
        console.error(
          `[FAIL - LEAKED] "${item.claim}" should have been blocked but passed! Status: ${vc.status} / ${vc.factCheckStatus}`,
        );
        failed++;
      }
    } else {
      if (vc.status !== "BLOCKED" && result.unsupportedClaimsCount === 0) {
        console.log(`[PASS - APPROVED] "${item.claim}" was correctly validated (SUPPORTED)`);
        passed++;
      } else {
        console.error(
          `[FAIL - FALSE REJECTION] "${item.claim}" should have been supported but was flagged: ${vc.status} / ${vc.factCheckStatus}`,
        );
        failed++;
      }
    }
  }

  console.log(`\nAdversarial Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    console.error("\n>>> Fact Guard Adversarial Test: FAILED <<<");
    process.exit(1);
  } else {
    console.log("\n>>> Fact Guard Adversarial Test: ALL CHECKS PASSED <<<");
  }
}

runFactGuardAdversarialTest();
