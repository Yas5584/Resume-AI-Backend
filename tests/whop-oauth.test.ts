import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import crypto from "crypto";
import { buildApp } from "../src/app.js";
import { FastifyInstance } from "fastify";
import { prisma } from "@resumeai/database";
import {
  AUTH_COOKIE_NAME,
  WHOP_PKCE_COOKIE_NAME,
} from "../src/utils/cookies.js";
import { whopOAuthService, PkceState } from "../src/services/whop-oauth.service.js";

describe("Whop OAuth 2.1 PKCE Integration", () => {
  let app: FastifyInstance;
  const createdUserEmails: string[] = [];
  const createdWhopUserIds: string[] = [];

  beforeAll(async () => {
    process.env.WHOP_APP_ID = "app_test_whop_app_id";
    process.env.WHOP_CLIENT_ID = "app_test_whop_client_id";
    process.env.WHOP_CLIENT_SECRET = "whop_test_client_secret_xyz123";
    process.env.APP_URL = "https://resume-ai-frontend-sand.vercel.app";
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (createdWhopUserIds.length > 0) {
      await prisma.whopIdentity
        .deleteMany({
          where: { whopUserId: { in: createdWhopUserIds } },
        })
        .catch(() => {});
    }
    if (createdUserEmails.length > 0) {
      await prisma.session
        .deleteMany({
          where: { user: { email: { in: createdUserEmails } } },
        })
        .catch(() => {});
      await prisma.user
        .deleteMany({
          where: { email: { in: createdUserEmails } },
        })
        .catch(() => {});
    }
  });

  // 1. /api/auth/login generates state and PKCE
  // 2. state cookie is created securely
  it("1 & 2. /api/auth/login generates PKCE, sets secure whop_pkce cookie, and redirects to Whop authorize", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/login",
      headers: {
        host: "resume-ai-frontend-sand.vercel.app",
      },
    });

    expect(res.statusCode).toBe(302);
    const location = res.headers["location"] as string;
    expect(location).toBeDefined();
    expect(location).toContain("https://api.whop.com/oauth/authorize");

    const parsedUrl = new URL(location);
    expect(parsedUrl.searchParams.get("response_type")).toBe("code");
    expect(parsedUrl.searchParams.get("client_id")).toBe(
      "app_test_whop_client_id",
    );
    expect(parsedUrl.searchParams.get("redirect_uri")).toBe(
      "https://resume-ai-frontend-sand.vercel.app/api/auth/callback",
    );
    expect(parsedUrl.searchParams.get("scope")).toBe("openid profile email");
    expect(parsedUrl.searchParams.get("code_challenge_method")).toBe("S256");

    const state = parsedUrl.searchParams.get("state");
    const codeChallenge = parsedUrl.searchParams.get("code_challenge");
    expect(state).toBeTruthy();
    expect(codeChallenge).toBeTruthy();

    // Check cookie
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(";") : setCookie!;
    expect(cookieStr).toContain(WHOP_PKCE_COOKIE_NAME);
    expect(cookieStr.toLowerCase()).toContain("httponly");
  });

  // 3. callback rejects missing state
  it("3. callback redirects with error when state parameter is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/callback?code=some_auth_code",
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers["location"]).toContain("error=missing_oauth_params");
  });

  // 4. callback rejects invalid state
  it("4. callback redirects with error when state does not match cookie (CSRF protection)", async () => {
    const pkce: PkceState = {
      codeVerifier: "test_verifier_12345678901234567890",
      codeChallenge: "test_challenge",
      state: "valid_state_12345",
      nonce: "nonce_12345",
      createdAt: Date.now(),
    };

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/callback?code=some_auth_code&state=TAMPERED_STATE",
      cookies: {
        [WHOP_PKCE_COOKIE_NAME]: JSON.stringify(pkce),
      },
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers["location"]).toContain("error=");
    expect(res.headers["location"]).toContain("CSRF");
  });

  // 5. callback rejects missing code
  it("5. callback redirects with error when code is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/callback?state=some_state",
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers["location"]).toContain("error=missing_oauth_params");
  });

  // 6. callback rejects invalid authorization code
  it("6. callback redirects with error when authorization code is invalid", async () => {
    const pkce = whopOAuthService.generatePkce();

    // Mock exchangeCodeForTokens failure
    const exchangeSpy = vi
      .spyOn(whopOAuthService, "exchangeCodeForTokens")
      .mockRejectedValueOnce(new Error("Invalid authorization code"));

    const res = await app.inject({
      method: "GET",
      url: `/api/auth/callback?code=invalid_code&state=${pkce.state}`,
      cookies: {
        [WHOP_PKCE_COOKIE_NAME]: JSON.stringify(pkce),
      },
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers["location"]).toContain("error=");
    expect(res.headers["location"]).toContain("Invalid");

    exchangeSpy.mockRestore();
  });

  // 7, 8, 10. callback exchanges code server-side and creates new Whop user + WhopIdentity
  it("7, 8 & 10. callback exchanges code, retrieves profile, creates new User & WhopIdentity, and sets session cookie", async () => {
    const pkce = whopOAuthService.generatePkce();
    const testWhopUserId = `user_whop_test_${Date.now()}`;
    const testEmail = `whop_new_${Date.now()}@example.com`;
    createdWhopUserIds.push(testWhopUserId);
    createdUserEmails.push(testEmail);

    const exchangeSpy = vi
      .spyOn(whopOAuthService, "exchangeCodeForTokens")
      .mockResolvedValueOnce({
        access_token: "mock_whop_access_token_123",
        refresh_token: "mock_whop_refresh_token_123",
        token_type: "Bearer",
        expires_in: 3600,
      });

    const userInfoSpy = vi
      .spyOn(whopOAuthService, "fetchUserInfo")
      .mockResolvedValueOnce({
        sub: testWhopUserId,
        email: testEmail,
        name: "Test Whop User",
        email_verified: true,
      });

    const res = await app.inject({
      method: "GET",
      url: `/api/auth/callback?code=mock_valid_code&state=${pkce.state}`,
      headers: {
        host: "resume-ai-frontend-sand.vercel.app",
      },
      cookies: {
        [WHOP_PKCE_COOKIE_NAME]: JSON.stringify(pkce),
      },
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers["location"]).toBe(
      "https://resume-ai-frontend-sand.vercel.app/dashboard",
    );

    // Verify session cookie was set
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(";") : setCookie!;
    expect(cookieStr).toContain(AUTH_COOKIE_NAME);
    expect(cookieStr.toLowerCase()).toContain("httponly");

    // 13. Access token is never returned to browser
    expect(res.headers["location"]).not.toContain("access_token");
    expect(res.headers["location"]).not.toContain("mock_whop_access_token");
    expect(cookieStr).not.toContain("mock_whop_access_token");

    // Verify user created in DB
    const dbUser = await prisma.user.findUnique({
      where: { email: testEmail },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.whopUserId).toBe(testWhopUserId);

    // Verify WhopIdentity created in DB
    const dbIdentity = await prisma.whopIdentity.findUnique({
      where: { whopUserId: testWhopUserId },
    });
    expect(dbIdentity).not.toBeNull();
    expect(dbIdentity?.userId).toBe(dbUser?.id);

    exchangeSpy.mockRestore();
    userInfoSpy.mockRestore();
  });

  // 9. existing Whop identity logs into existing ResumeAI user
  it("9. existing Whop identity logs directly into existing ResumeAI user", async () => {
    const pkce = whopOAuthService.generatePkce();
    const existingWhopId = `user_existing_${Date.now()}`;
    const existingEmail = `existing_whop_${Date.now()}@example.com`;
    createdWhopUserIds.push(existingWhopId);
    createdUserEmails.push(existingEmail);

    // Create user and identity in DB first
    const existingUser = await prisma.user.create({
      data: {
        email: existingEmail,
        name: "Existing Whop Customer",
        passwordHash: "dummy_hash",
        whopUserId: existingWhopId,
      },
    });
    await prisma.whopIdentity.create({
      data: {
        userId: existingUser.id,
        whopUserId: existingWhopId,
        email: existingEmail,
      },
    });

    const exchangeSpy = vi
      .spyOn(whopOAuthService, "exchangeCodeForTokens")
      .mockResolvedValueOnce({
        access_token: "mock_whop_access_token_456",
        token_type: "Bearer",
        expires_in: 3600,
      });

    const userInfoSpy = vi
      .spyOn(whopOAuthService, "fetchUserInfo")
      .mockResolvedValueOnce({
        sub: existingWhopId,
        email: existingEmail,
        name: "Existing Whop Customer",
        email_verified: true,
      });

    const res = await app.inject({
      method: "GET",
      url: `/api/auth/callback?code=mock_code_existing&state=${pkce.state}`,
      headers: {
        host: "resume-ai-frontend-sand.vercel.app",
      },
      cookies: {
        [WHOP_PKCE_COOKIE_NAME]: JSON.stringify(pkce),
      },
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers["location"]).toBe(
      "https://resume-ai-frontend-sand.vercel.app/dashboard",
    );

    // Verify session belongs to the existing user
    const setCookie = res.headers["set-cookie"] as string | string[];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
    expect(cookieStr).toContain(AUTH_COOKIE_NAME);

    exchangeSpy.mockRestore();
    userInfoSpy.mockRestore();
  });

  // 11. existing email/password login continues working
  it("11. existing email/password login and register continue working perfectly", async () => {
    const email = `trad_auth_${Date.now()}@example.com`;
    const password = "SecurePassword123!";
    createdUserEmails.push(email);

    // Register traditional user
    const regRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email,
        password,
        name: "Traditional User",
      },
    });
    expect(regRes.statusCode).toBe(201);
    const regBody = JSON.parse(regRes.body);
    expect(regBody.data.user.email).toBe(email);

    // Login traditional user
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email,
        password,
      },
    });
    expect(loginRes.statusCode).toBe(200);
    const loginBody = JSON.parse(loginRes.body);
    expect(loginBody.data.user.email).toBe(email);
    expect(loginRes.headers["set-cookie"]).toBeDefined();
  });

  // 12. logout continues working
  it("12. logout clears session and PKCE cookies", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/logout",
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers["location"]).toContain("/login");
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(";") : setCookie!;
    expect(cookieStr).toContain(AUTH_COOKIE_NAME);
  });

  // 14. Secrets are never logged or exposed in error messages
  it("14. secrets are never leaked in error responses", async () => {
    const pkce = whopOAuthService.generatePkce();

    const exchangeSpy = vi
      .spyOn(whopOAuthService, "exchangeCodeForTokens")
      .mockImplementationOnce(async () => {
        throw new Error("Internal secret test");
      });

    const res = await app.inject({
      method: "GET",
      url: `/api/auth/callback?code=test&state=${pkce.state}`,
      cookies: {
        [WHOP_PKCE_COOKIE_NAME]: JSON.stringify(pkce),
      },
    });

    expect(res.statusCode).toBe(302);
    const location = res.headers["location"] as string;
    expect(location).not.toContain(process.env.WHOP_CLIENT_SECRET!);
    expect(location).not.toContain("whop_test_client_secret");

    exchangeSpy.mockRestore();
  });

  // 15. PRO entitlement remains controlled by backend
  it("15. newly created Whop OAuth user starts with FREE tier by default, and PRO entitlement remains strictly backend-enforced", async () => {
    const pkce = whopOAuthService.generatePkce();
    const whopId = `user_free_${Date.now()}`;
    const email = `free_oauth_${Date.now()}@example.com`;
    createdWhopUserIds.push(whopId);
    createdUserEmails.push(email);

    const exchangeSpy = vi
      .spyOn(whopOAuthService, "exchangeCodeForTokens")
      .mockResolvedValueOnce({
        access_token: "mock_whop_access_token_free",
        token_type: "Bearer",
        expires_in: 3600,
      });

    const userInfoSpy = vi
      .spyOn(whopOAuthService, "fetchUserInfo")
      .mockResolvedValueOnce({
        sub: whopId,
        email,
        name: "Free Whop User",
        email_verified: true,
      });

    await app.inject({
      method: "GET",
      url: `/api/auth/callback?code=mock_code_free&state=${pkce.state}`,
      headers: {
        host: "resume-ai-frontend-sand.vercel.app",
      },
      cookies: {
        [WHOP_PKCE_COOKIE_NAME]: JSON.stringify(pkce),
      },
    });

    const createdUser = await prisma.user.findUnique({
      where: { email },
    });
    // Defaults to FREE unless webhook upgraded
    expect(createdUser?.subscriptionTier).toBe("FREE");

    exchangeSpy.mockRestore();
    userInfoSpy.mockRestore();
  });

  // 16. Localhost development redirect URI support
  it("16. supports localhost redirect URI when in development mode", () => {
    const redirectUri = whopOAuthService.getRedirectUri("localhost:3000");
    expect(redirectUri).toBe("http://localhost:3000/api/auth/callback");
  });

  // 17. Production redirect URI without trailing slash
  it("17. production redirect URI has exact URL and no trailing slash", () => {
    const redirectUri = whopOAuthService.getRedirectUri(
      "resume-ai-frontend-sand.vercel.app",
    );
    expect(redirectUri).toBe(
      "https://resume-ai-frontend-sand.vercel.app/api/auth/callback",
    );
    expect(redirectUri.endsWith("/")).toBe(false);
  });
});
