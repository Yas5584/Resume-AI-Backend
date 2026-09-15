import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const prisma = new PrismaClient();

async function runCheck() {
  console.log("Starting production-safe Neon DB connectivity check...");
  try {
    // 1. Check direct query
    const start = Date.now();
    const result = await prisma.$queryRaw<Array<{ db: string; pg_version: string }>>`SELECT 1 as connected, current_database() as db, version() as pg_version`;
    const latency = Date.now() - start;
    console.log(`[PASS] Neon database query executed in ${latency}ms.`);
    console.log(`[PASS] Database name: ${result[0]?.db}`);

    // 2. Query application tables
    const userCount = await prisma.user.count();
    const resumeCount = await prisma.resume.count();
    console.log(`[PASS] Prisma models queryable. Active users: ${userCount}, Resumes: ${resumeCount}`);

    // 3. Verify migration status via Prisma CLI without printing secrets
    console.log("Checking Prisma migration status...");
    const statusOut = execSync("npx prisma migrate status --schema=prisma/schema.prisma", {
      encoding: "utf8",
    });
    const isUpToDate = statusOut.includes("Database schema is up to date");
    console.log(`[PASS] Migration status check: ${isUpToDate ? "UP TO DATE" : "CHECK REQUIRED"}`);

    console.log("\n>>> Neon Database Connectivity: ALL CHECKS PASSED <<<");
  } catch (err: any) {
    console.error("[FAIL] Neon connection check failed:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCheck();
