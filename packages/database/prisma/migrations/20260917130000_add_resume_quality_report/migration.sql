-- CreateEnum
CREATE TYPE "ResumeQualityReportStatus" AS ENUM ('CURRENT', 'STALE');

-- CreateTable
CREATE TABLE "resume_quality_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "resumeVersionId" TEXT,
    "jobId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "categoryScores" JSONB NOT NULL,
    "findings" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "strengths" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "jobHash" TEXT,
    "status" "ResumeQualityReportStatus" NOT NULL DEFAULT 'CURRENT',
    "resumeUpdatedAt" TIMESTAMP(3) NOT NULL,
    "analyzerVersion" TEXT NOT NULL DEFAULT '1.0',
    "scoringVersion" TEXT NOT NULL DEFAULT '1.0',
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "processingTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_quality_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resume_quality_reports_userId_idx" ON "resume_quality_reports"("userId");

-- CreateIndex
CREATE INDEX "resume_quality_reports_resumeId_idx" ON "resume_quality_reports"("resumeId");

-- CreateIndex
CREATE INDEX "resume_quality_reports_jobId_idx" ON "resume_quality_reports"("jobId");

-- CreateIndex
CREATE INDEX "resume_quality_reports_contentHash_idx" ON "resume_quality_reports"("contentHash");

-- CreateIndex
CREATE INDEX "resume_quality_reports_status_idx" ON "resume_quality_reports"("status");

-- AddForeignKey
ALTER TABLE "resume_quality_reports" ADD CONSTRAINT "resume_quality_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_quality_reports" ADD CONSTRAINT "resume_quality_reports_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_quality_reports" ADD CONSTRAINT "resume_quality_reports_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "resume_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_quality_reports" ADD CONSTRAINT "resume_quality_reports_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job_descriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
