var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));

// packages/database/src/index.ts
var index_exports = {};
__export(index_exports, {
  ContentProposalStatus: () => ContentProposalStatus,
  ImportStatus: () => ImportStatus,
  JobAnalysisStatus: () => JobAnalysisStatus,
  Prisma: () => Prisma,
  PrismaClient: () => PrismaClient,
  ResumeQualityReportStatus: () => ResumeQualityReportStatus,
  Role: () => Role,
  StrategyApprovalStatus: () => StrategyApprovalStatus,
  SubscriptionTier: () => SubscriptionTier,
  WorkflowStatus: () => WorkflowStatus,
  WorkflowType: () => WorkflowType,
  prisma: () => prisma
});

// packages/database/src/client.ts
var client_exports = {};
__export(client_exports, {
  ContentProposalStatus: () => ContentProposalStatus,
  ImportStatus: () => ImportStatus,
  JobAnalysisStatus: () => JobAnalysisStatus,
  Prisma: () => Prisma,
  PrismaClient: () => PrismaClient,
  ResumeQualityReportStatus: () => ResumeQualityReportStatus,
  Role: () => Role,
  StrategyApprovalStatus: () => StrategyApprovalStatus,
  SubscriptionTier: () => SubscriptionTier,
  WorkflowStatus: () => WorkflowStatus,
  WorkflowType: () => WorkflowType,
  prisma: () => prisma
});
__reExport(client_exports, client_star);
import {
  PrismaClient,
  Prisma,
  Role,
  SubscriptionTier,
  WorkflowStatus,
  WorkflowType,
  ImportStatus,
  JobAnalysisStatus,
  StrategyApprovalStatus,
  ContentProposalStatus,
  ResumeQualityReportStatus
} from "@prisma/client";
import * as client_star from "@prisma/client";
var prisma = globalThis.prismaGlobal ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
});
globalThis.prismaGlobal = prisma;

// packages/database/src/index.ts
__reExport(index_exports, client_exports);
export {
  ContentProposalStatus,
  ImportStatus,
  JobAnalysisStatus,
  Prisma,
  PrismaClient,
  ResumeQualityReportStatus,
  Role,
  StrategyApprovalStatus,
  SubscriptionTier,
  WorkflowStatus,
  WorkflowType,
  prisma
};
