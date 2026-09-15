import { buildApp } from "./app.js";
import { env } from "./config/index.js";

async function start() {
  const app = await buildApp();

  try {
    const port =
      process.env.NODE_ENV === "production" && process.env.PORT
        ? Number(process.env.PORT)
        : env.API_PORT;
    const host =
      process.env.NODE_ENV === "production" ? "0.0.0.0" : env.API_HOST;

    const address = await app.listen({
      port,
      host,
    });
    console.log(`ResumeAI API Server listening at: ${address}`);
    console.log(`Health endpoint: ${address}/health`);
    console.log(`API Health endpoint: ${address}/api/health`);

    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      await app.close();
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Start server when executed directly
start();
