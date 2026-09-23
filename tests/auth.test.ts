import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { AUTH_COOKIE_NAME } from "../src/utils/cookies.js";

describe("Authentication Endpoints (Phase 1)", () => {
  let app: FastifyInstance;
  const testEmail = `test.user.${Date.now()}@example.com`;
  const testPassword = "Password123!";
  const testName = "Test User";

  let sessionCookie: string;
  let authToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/auth/register", () => {
    it("should reject registration with invalid email", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: "not-an-email",
          password: testPassword,
          name: testName,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject registration with short password (< 8 chars)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: `short.${Date.now()}@example.com`,
          password: "short",
          name: testName,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
    });

    it("should successfully register a new user and set HttpOnly session cookie", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: testEmail,
          password: testPassword,
          name: testName,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe(testEmail.toLowerCase());
      expect(body.data.user.name).toBe(testName);
      expect(body.data.user.role).toBe("USER");
      expect(body.data.user.subscriptionTier).toBe("FREE");
      expect(body.data.user.creditsBalance).toBe(10);
      expect(body.data.token).toBeDefined();

      // Verify Set-Cookie header is present with HttpOnly
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies)
        ? cookies.join("; ")
        : (cookies as string);
      expect(cookieStr).toContain(AUTH_COOKIE_NAME);
      expect(cookieStr).toContain("HttpOnly");

      // Save cookie and token for subsequent tests
      sessionCookie = cookieStr.split(";")[0];
      authToken = body.data.token;
    });

    it("should reject duplicate email registration with 409 CONFLICT", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: testEmail,
          password: testPassword,
          name: "Another Name",
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CONFLICT");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should reject login with wrong password", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: testEmail,
          password: "WrongPassword!",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should reject login with non-existent email", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "nobody@example.com",
          password: testPassword,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
    });

    it("should login successfully and return new cookie", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe(testEmail.toLowerCase());
      expect(body.data.token).toBeDefined();

      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies)
        ? cookies.join("; ")
        : (cookies as string);
      expect(cookieStr).toContain(AUTH_COOKIE_NAME);
      expect(cookieStr).toContain("HttpOnly");

      sessionCookie = cookieStr.split(";")[0];
      authToken = body.data.token;
    });
  });

  describe("GET /api/auth/me", () => {
    it("should reject request without cookie or token with 401", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
    });

    it("should authenticate using HttpOnly cookie", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          cookie: sessionCookie,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe(testEmail.toLowerCase());
      expect(body.data.name).toBe(testName);
    });

    it("should authenticate using Authorization Bearer header as fallback", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe(testEmail.toLowerCase());
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should clear the cookie and invalidate the session", async () => {
      // 1. Logout
      const logoutResponse = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
        headers: {
          cookie: sessionCookie,
        },
      });

      expect(logoutResponse.statusCode).toBe(200);
      const logoutBody = JSON.parse(logoutResponse.payload);
      expect(logoutBody.success).toBe(true);

      // Verify cookie is cleared (max-age 0 / expires in past / empty value)
      const setCookies = logoutResponse.headers["set-cookie"];
      expect(setCookies).toBeDefined();

      // 2. Attempting to use the old session cookie should now fail (revoked from DB)
      const meResponse = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          cookie: sessionCookie,
        },
      });

      expect(meResponse.statusCode).toBe(401);
    });
  });

  describe("Security & Session Edge Cases", () => {
    it("should reject token when session is directly deleted from database", async () => {
      // 1. Login to get a valid session
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: testEmail,
          password: testPassword,
        },
      });
      const cookie = loginRes.headers["set-cookie"] as string;
      const token = JSON.parse(loginRes.payload).data.token;

      // 2. Verify it works
      const verifyRes = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { cookie: Array.isArray(cookie) ? cookie[0] : cookie },
      });
      expect(verifyRes.statusCode).toBe(200);

      // 3. Directly delete the session from the database
      const { userRepository } =
        await import("../src/repositories/user.repository.js");
      const jwt = (await import("jsonwebtoken")).default;
      const decoded = jwt.decode(token) as any;
      await userRepository.deleteSessionById(decoded.sessionId);

      // 4. Request should now be rejected with 401
      const afterDeleteRes = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { cookie: Array.isArray(cookie) ? cookie[0] : cookie },
      });
      expect(afterDeleteRes.statusCode).toBe(401);
    });

    it("should reject token with expired session in database", async () => {
      // 1. Register a temporary user
      const tempEmail = `temp.expired.${Date.now()}@example.com`;
      const regRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: tempEmail,
          password: testPassword,
          name: "Temp Expired",
        },
      });
      const token = JSON.parse(regRes.payload).data.token;
      const cookie = regRes.headers["set-cookie"] as string;

      // 2. Manipulate session expiresAt in DB to the past
      const { prisma } = await import("@resumeai/database");
      const jwt = (await import("jsonwebtoken")).default;
      const decoded = jwt.decode(token) as any;
      await prisma.session.update({
        where: { token: decoded.sessionId },
        data: { expiresAt: new Date(Date.now() - 10000) },
      });

      // 3. Request should be rejected with 401
      const expiredRes = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { cookie: Array.isArray(cookie) ? cookie[0] : cookie },
      });
      expect(expiredRes.statusCode).toBe(401);
    });

    it("should reject token missing sessionId claim", async () => {
      const jwt = (await import("jsonwebtoken")).default;
      const { env } = await import("../src/config/index.js");

      // Sign a token without sessionId
      const forgedToken = jwt.sign(
        { id: "some-id", email: "test@example.com", role: "USER" },
        env.JWT_SECRET,
        { expiresIn: "1h" },
      );

      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          authorization: `Bearer ${forgedToken}`,
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it("should reject malformed or tampered token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          authorization: "Bearer totally-malformed-token-string",
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it("should reject CORS request from unauthorized origin", async () => {
      const res = await app.inject({
        method: "OPTIONS",
        url: "/api/auth/login",
        headers: {
          origin: "http://malicious-attacker-website.com",
          "access-control-request-method": "POST",
        },
      });

      // Origin not in whitelist should not have Access-Control-Allow-Origin matching attacker
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("should clear stale HttpOnly cookie on 401 when session is invalid or revoked", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          cookie: "resumeai_session=invalid-or-revoked-jwt-token",
        },
      });

      expect(res.statusCode).toBe(401);
      const setCookie = res.headers["set-cookie"];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie) ? setCookie.join("; ") : String(setCookie);
      expect(cookieStr).toContain("resumeai_session=;");
    });

    it("should allow POST /api/auth/logout even when session is already expired and clear cookie", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
        headers: {
          cookie: "resumeai_session=expired-token-value",
        },
      });

      expect(res.statusCode).toBe(200);
      const setCookie = res.headers["set-cookie"];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie) ? setCookie.join("; ") : String(setCookie);
      expect(cookieStr).toContain("resumeai_session=;");
    });
  });
});
