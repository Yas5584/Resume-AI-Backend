import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";

describe("API Health Endpoint", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health should return 200 OK with healthy status payload", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);

    const payload = JSON.parse(response.payload);
    expect(payload).toMatchObject({
      success: true,
      service: "resumeai-api",
      status: "healthy",
    });
    expect(payload).toHaveProperty("timestamp");
    expect(payload).toHaveProperty("uptimeSeconds");
    expect(typeof payload.uptimeSeconds).toBe("number");
  });
});
