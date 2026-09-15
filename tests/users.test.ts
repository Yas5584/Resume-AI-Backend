import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";

describe("User Profile Endpoints (Phase 1)", () => {
  let app: FastifyInstance;
  const testEmail = `profile.user.${Date.now()}@example.com`;
  const testPassword = "Password123!";
  const initialName = "Initial Profile Name";
  let sessionCookie: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Register a user for profile testing
    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: testEmail,
        password: testPassword,
        name: initialName,
      },
    });

    const cookies = registerRes.headers["set-cookie"];
    const cookieStr = Array.isArray(cookies)
      ? cookies.join("; ")
      : (cookies as string);
    sessionCookie = cookieStr.split(";")[0];
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/users/me", () => {
    it("should return 401 when unauthenticated", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/users/me",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return current user profile when authenticated", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/users/me",
        headers: {
          cookie: sessionCookie,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe(testEmail.toLowerCase());
      expect(body.data.name).toBe(initialName);
      expect(body.data.role).toBe("USER");
      expect(body.data.subscriptionTier).toBe("FREE");
      expect(body.data.creditsBalance).toBe(10);
      expect(body.data).toHaveProperty("createdAt");
    });
  });

  describe("PATCH /api/users/me", () => {
    it("should return 401 when unauthenticated", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/users/me",
        payload: {
          name: "New Name",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject update with empty name", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/users/me",
        headers: {
          cookie: sessionCookie,
        },
        payload: {
          name: "",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should successfully update profile name", async () => {
      const updatedName = "Updated Name via PATCH";
      const response = await app.inject({
        method: "PATCH",
        url: "/api/users/me",
        headers: {
          cookie: sessionCookie,
        },
        payload: {
          name: updatedName,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe(updatedName);

      // Verify that GET /api/users/me now reflects the update
      const getRes = await app.inject({
        method: "GET",
        url: "/api/users/me",
        headers: {
          cookie: sessionCookie,
        },
      });

      const getBody = JSON.parse(getRes.payload);
      expect(getBody.data.name).toBe(updatedName);
    });

    it("should reject malicious payloads containing unauthorized fields (e.g., role, passwordHash, id)", async () => {
      const maliciousPayload = {
        name: "Legit Name",
        role: "ADMIN",
        passwordHash: "forged-hash",
        id: "another-uuid",
        creditsBalance: 99999,
      };

      const response = await app.inject({
        method: "PATCH",
        url: "/api/users/me",
        headers: {
          cookie: sessionCookie,
        },
        payload: maliciousPayload,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should never expose passwordHash in profile responses", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/users/me",
        headers: {
          cookie: sessionCookie,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).not.toHaveProperty("passwordHash");
      expect(body.data).not.toHaveProperty("password");
      expect(JSON.stringify(body)).not.toContain("passwordHash");
    });

    it("should strictly isolate user data between distinct accounts", async () => {
      // 1. Create User B
      const userBEmail = `user.b.${Date.now()}@example.com`;
      const regB = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: userBEmail, password: testPassword, name: "User B" },
      });
      const cookiesB = regB.headers["set-cookie"];
      const cookieStrB = Array.isArray(cookiesB)
        ? cookiesB[0]
        : (cookiesB as string);
      const cookieB = cookieStrB.split(";")[0];

      // 2. User B requests /api/users/me
      const resB = await app.inject({
        method: "GET",
        url: "/api/users/me",
        headers: { cookie: cookieB },
      });
      const dataB = JSON.parse(resB.payload).data;

      // 3. User A requests /api/users/me with User B's id in query/body
      const resA = await app.inject({
        method: "GET",
        url: `/api/users/me?userId=${dataB.id}`,
        headers: { cookie: sessionCookie },
      });
      const dataA = JSON.parse(resA.payload).data;

      // User A must strictly receive User A's data, completely ignoring any query param
      expect(dataA.email).toBe(testEmail.toLowerCase());
      expect(dataA.id).not.toBe(dataB.id);
    });
  });
});
