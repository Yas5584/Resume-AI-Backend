import { pdfResumeExporter } from "../src/export/pdf-exporter.js";
import { ResumeData, TemplateConfig } from "@resumeai/shared";

async function runPdfTest() {
  console.log("Starting Playwright PDF export verification...");

  const mockResumeData: ResumeData = {
    personalInfo: {
      fullName: "Alex Chen",
      email: "alex.chen@example.com",
      phone: "+1 555-0199",
      location: "San Francisco, CA",
      title: "Senior Full Stack Engineer",
      summary: "Experienced software engineer with 6+ years specializing in TypeScript, React, and Node.js.",
    },
    experience: [
      {
        id: "exp-1",
        company: "Tech Corp",
        position: "Lead Engineer",
        startDate: "2021-01",
        current: true,
        description: "Architected microservices and scaled React applications to over 100K MAU.",
        highlights: ["Improved latency by 45%", "Managed team of 6 engineers"],
      },
    ],
    education: [
      {
        id: "edu-1",
        institution: "University of California",
        degree: "B.S. Computer Science",
        startDate: "2015",
        endDate: "2019",
      },
    ],
    skills: [
      {
        id: "cat-1",
        category: "Languages",
        items: ["TypeScript", "Python", "SQL"],
      },
    ],
  };

  const mockTemplateConfig: TemplateConfig = {
    templateId: "modern-standard",
    pageSize: "a4",
    primaryColor: "#2563eb",
    fontFamily: "Inter",
  };

  try {
    const start = Date.now();
    const result = await pdfResumeExporter.export(
      mockResumeData,
      mockTemplateConfig,
      "Alex_Chen_Resume",
    );
    const duration = Date.now() - start;

    console.log(`[PASS] PDF generated successfully in ${duration}ms!`);
    console.log(`[PASS] Filename: ${result.filename}`);
    console.log(`[PASS] MimeType: ${result.mimeType}`);
    console.log(`[PASS] Buffer size: ${result.buffer.length} bytes`);

    // Verify PDF header magic bytes (%PDF-)
    const pdfMagic = Buffer.from("%PDF-");
    const hasMagic = result.buffer.subarray(0, 5).equals(pdfMagic);
    console.log(`[PASS] PDF Magic Bytes verified: ${hasMagic}`);

    if (!hasMagic || result.buffer.length < 1000) {
      throw new Error("Invalid or empty PDF buffer generated");
    }

    console.log("\n>>> Playwright PDF Generation: ALL CHECKS PASSED <<<");
  } catch (err: any) {
    console.error("[FAIL] PDF Generation failed:", err.stack || err.message);
    process.exit(1);
  }
}

runPdfTest();
