-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('CREATE_RESUME', 'JOB_TAILORING', 'RESUME_REVIEW');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'EXTRACTING', 'PARSING', 'VALIDATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobAnalysisStatus" AS ENUM ('PENDING', 'ANALYZING', 'VALIDATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "StrategyApprovalStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED');

-- CreateEnum
CREATE TYPE "ContentProposalStatus" AS ENUM ('DRAFT', 'PARTIALLY_ACCEPTED', 'ACCEPTED', 'REJECTED', 'STALE', 'APPLIED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "creditsBalance" INTEGER NOT NULL DEFAULT 10,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "expiresAt" INTEGER,
    "tokenType" TEXT,
    "scope" TEXT,
    "idToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled Resume',
    "currentTemplateId" TEXT NOT NULL DEFAULT 'modern-standard',
    "targetRole" TEXT,
    "resumeData" JSONB NOT NULL,
    "templateConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_versions" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "resumeData" JSONB NOT NULL,
    "templateConfig" JSONB,
    "changeSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_descriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "company" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Untitled Position',
    "rawText" TEXT NOT NULL,
    "normalizedText" TEXT,
    "status" "JobAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "parsedData" JSONB,
    "errorMessage" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "processingTimeMs" INTEGER,
    "url" TEXT,
    "resumeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_job_analyses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "resumeVersionId" TEXT,
    "jobId" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "scoreVersion" TEXT NOT NULL DEFAULT 'v1',
    "resumeUpdatedAt" TIMESTAMP(3),
    "jobUpdatedAt" TIMESTAMP(3),
    "analysisData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_job_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_strategies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "matchId" TEXT,
    "strategyVersion" TEXT NOT NULL DEFAULT 'v1',
    "status" "StrategyApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "resumeUpdatedAt" TIMESTAMP(3),
    "jobUpdatedAt" TIMESTAMP(3),
    "matchUpdatedAt" TIMESTAMP(3),
    "strategyData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_proposals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobId" TEXT,
    "matchId" TEXT,
    "strategyId" TEXT,
    "appliedVersionId" TEXT,
    "status" "ContentProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "resumeUpdatedAt" TIMESTAMP(3),
    "jobUpdatedAt" TIMESTAMP(3),
    "matchUpdatedAt" TIMESTAMP(3),
    "strategyUpdatedAt" TIMESTAMP(3),
    "proposalData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_workflow_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT,
    "workflowType" "WorkflowType" NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "inputPayload" JSONB NOT NULL,
    "outputPayload" JSONB,
    "errorMessage" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "costEstimate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ai_workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_workflow_steps" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "inputPayload" JSONB,
    "outputPayload" JSONB,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workflowRunId" TEXT,
    "agentName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_imports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT,
    "extractedText" TEXT,
    "parseConfidence" JSONB,
    "resumeId" TEXT,
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "processingTimeMs" INTEGER,
    "aiTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "aiCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "resumes_userId_idx" ON "resumes"("userId");

-- CreateIndex
CREATE INDEX "resume_versions_resumeId_idx" ON "resume_versions"("resumeId");

-- CreateIndex
CREATE UNIQUE INDEX "resume_versions_resumeId_versionNumber_key" ON "resume_versions"("resumeId", "versionNumber");

-- CreateIndex
CREATE INDEX "job_descriptions_userId_idx" ON "job_descriptions"("userId");

-- CreateIndex
CREATE INDEX "job_descriptions_status_idx" ON "job_descriptions"("status");

-- CreateIndex
CREATE INDEX "job_descriptions_resumeId_idx" ON "job_descriptions"("resumeId");

-- CreateIndex
CREATE INDEX "resume_job_analyses_userId_idx" ON "resume_job_analyses"("userId");

-- CreateIndex
CREATE INDEX "resume_job_analyses_resumeId_idx" ON "resume_job_analyses"("resumeId");

-- CreateIndex
CREATE INDEX "resume_job_analyses_jobId_idx" ON "resume_job_analyses"("jobId");

-- CreateIndex
CREATE INDEX "resume_strategies_userId_idx" ON "resume_strategies"("userId");

-- CreateIndex
CREATE INDEX "resume_strategies_resumeId_idx" ON "resume_strategies"("resumeId");

-- CreateIndex
CREATE INDEX "resume_strategies_jobId_idx" ON "resume_strategies"("jobId");

-- CreateIndex
CREATE INDEX "resume_strategies_matchId_idx" ON "resume_strategies"("matchId");

-- CreateIndex
CREATE INDEX "content_proposals_userId_idx" ON "content_proposals"("userId");

-- CreateIndex
CREATE INDEX "content_proposals_resumeId_idx" ON "content_proposals"("resumeId");

-- CreateIndex
CREATE INDEX "content_proposals_jobId_idx" ON "content_proposals"("jobId");

-- CreateIndex
CREATE INDEX "content_proposals_matchId_idx" ON "content_proposals"("matchId");

-- CreateIndex
CREATE INDEX "content_proposals_strategyId_idx" ON "content_proposals"("strategyId");

-- CreateIndex
CREATE INDEX "content_proposals_status_idx" ON "content_proposals"("status");

-- CreateIndex
CREATE INDEX "ai_workflow_runs_userId_idx" ON "ai_workflow_runs"("userId");

-- CreateIndex
CREATE INDEX "ai_workflow_runs_status_idx" ON "ai_workflow_runs"("status");

-- CreateIndex
CREATE INDEX "ai_workflow_steps_workflowRunId_idx" ON "ai_workflow_steps"("workflowRunId");

-- CreateIndex
CREATE INDEX "ai_usages_userId_idx" ON "ai_usages"("userId");

-- CreateIndex
CREATE INDEX "ai_usages_createdAt_idx" ON "ai_usages"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "resume_imports_resumeId_key" ON "resume_imports"("resumeId");

-- CreateIndex
CREATE INDEX "resume_imports_userId_idx" ON "resume_imports"("userId");

-- CreateIndex
CREATE INDEX "resume_imports_status_idx" ON "resume_imports"("status");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_job_analyses" ADD CONSTRAINT "resume_job_analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_job_analyses" ADD CONSTRAINT "resume_job_analyses_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_job_analyses" ADD CONSTRAINT "resume_job_analyses_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "resume_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_job_analyses" ADD CONSTRAINT "resume_job_analyses_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_strategies" ADD CONSTRAINT "resume_strategies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_strategies" ADD CONSTRAINT "resume_strategies_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_strategies" ADD CONSTRAINT "resume_strategies_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_strategies" ADD CONSTRAINT "resume_strategies_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "resume_job_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_proposals" ADD CONSTRAINT "content_proposals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_proposals" ADD CONSTRAINT "content_proposals_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_proposals" ADD CONSTRAINT "content_proposals_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job_descriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_proposals" ADD CONSTRAINT "content_proposals_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "resume_job_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_proposals" ADD CONSTRAINT "content_proposals_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "resume_strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_proposals" ADD CONSTRAINT "content_proposals_appliedVersionId_fkey" FOREIGN KEY ("appliedVersionId") REFERENCES "resume_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_workflow_runs" ADD CONSTRAINT "ai_workflow_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_workflow_runs" ADD CONSTRAINT "ai_workflow_runs_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_workflow_steps" ADD CONSTRAINT "ai_workflow_steps_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "ai_workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usages" ADD CONSTRAINT "ai_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usages" ADD CONSTRAINT "ai_usages_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "ai_workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_imports" ADD CONSTRAINT "resume_imports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_imports" ADD CONSTRAINT "resume_imports_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

