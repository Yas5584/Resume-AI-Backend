import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_sCm3lizBoaI9@ep-curly-cell-a5elcatc-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    },
  },
});

async function main() {
  const imp = await prisma.resumeImport.findFirst({
    orderBy: { createdAt: "desc" },
  });
  console.log("=== FULL EXTRACTED TEXT ===");
  console.log(imp?.extractedText);
}

main().finally(() => prisma["$disconnect"]());
