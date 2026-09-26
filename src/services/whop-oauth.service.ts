import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../config/index.js";
import { AppError } from "../errors/index.js";
import { userRepository, UserRepository } from "../repositories/user.repository.js";
import { authService, AuthService } from "./auth.service.js";
import { whopWebhookService } from "./whop-webhook.service.js";
import { User } from "@resumeai/database";
import { AuthUser } from "@resumeai/shared";

export interface PkceState {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  nonce: string;
  createdAt: number;
}

const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  id_token: z.string().optional(),
  token_type: z.string(),
  expires_in: z.number(),
});

const userInfoSchema = z.object({
  sub: z.string(),
  name: z.string().optional(),
  preferred_username: z.string().optional(),
  picture: z.string().optional(),
  email: z.string().optional(),
  email_verified: z.boolean().optional(),
});

export type WhopTokens = z.infer<typeof tokenResponseSchema>;
export type WhopUserInfo = z.infer<typeof userInfoSchema>;

function base64url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export class WhopOAuthService {
  constructor(
    private userRepo: UserRepository = userRepository,
    private auth: AuthService = authService,
  ) {}

  getBaseUrl(): string {
    const isSandbox =
      process.env.WHOP_SANDBOX === "true" || env.WHOP_SANDBOX;
    return isSandbox
      ? "https://sandbox-api.whop.com"
      : "https://api.whop.com";
  }

  getClientId(): string {
    const id =
      process.env.WHOP_CLIENT_ID ||
      process.env.WHOP_APP_ID ||
      env.WHOP_CLIENT_ID ||
      env.WHOP_APP_ID;
    if (!id) {
      throw AppError.internal(
        "Whop Client ID is not configured (WHOP_CLIENT_ID or WHOP_APP_ID missing)",
      );
    }
    return id;
  }

  getClientSecret(): string {
    const secret =
      process.env.WHOP_CLIENT_SECRET || env.WHOP_CLIENT_SECRET;
    if (!secret) {
      throw AppError.internal(
        "Whop Client Secret is not configured (WHOP_CLIENT_SECRET missing)",
      );
    }
    return secret;
  }

  getRedirectUri(requestHost?: string): string {
    // Determine whether caller is local development or production
    const isLocalhost =
      requestHost &&
      (requestHost.includes("localhost") || requestHost.includes("127.0.0.1"));

    if (isLocalhost && env.NODE_ENV !== "production") {
      return "http://localhost:3000/api/auth/callback";
    }

    const appBase = env.APP_URL.replace(/\/+$/, "");
    return `${appBase}/api/auth/callback`;
  }

  generatePkce(): PkceState {
    const verifierBuffer = crypto.randomBytes(32);
    const codeVerifier = base64url(verifierBuffer);
    const codeChallenge = base64url(
      crypto.createHash("sha256").update(codeVerifier).digest(),
    );
    const state = base64url(crypto.randomBytes(16));
    const nonce = base64url(crypto.randomBytes(16));

    return {
      codeVerifier,
      codeChallenge,
      state,
      nonce,
      createdAt: Date.now(),
    };
  }

  buildAuthorizeUrl(pkce: PkceState, redirectUri: string): string {
    const clientId = this.getClientId();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "openid profile email",
      state: pkce.state,
      nonce: pkce.nonce,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: "S256",
    });

    return `${this.getBaseUrl()}/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<WhopTokens> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    const response = await fetch(`${this.getBaseUrl()}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      // Safe error message - never leak client_secret or internal keys
      const errorDesc =
        (errBody as any)?.error_description ||
        (errBody as any)?.error ||
        `HTTP ${response.status}`;
      throw AppError.badRequest(`Whop token exchange failed: ${errorDesc}`);
    }

    const data = await response.json();
    const parsed = tokenResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw AppError.internal("Malformed token response from Whop OAuth");
    }

    return parsed.data;
  }

  async fetchUserInfo(accessToken: string): Promise<WhopUserInfo> {
    const response = await fetch(`${this.getBaseUrl()}/oauth/userinfo`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw AppError.badRequest(
        `Failed to retrieve user info from Whop (HTTP ${response.status})`,
      );
    }

    const data = await response.json();
    const parsed = userInfoSchema.safeParse(data);
    if (!parsed.success) {
      throw AppError.internal("Malformed userinfo response from Whop OAuth");
    }

    return parsed.data;
  }

  async revokeToken(refreshToken: string): Promise<void> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    await fetch(`${this.getBaseUrl()}/oauth/revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }).catch(() => {
      // Best-effort revocation; ignore errors on revoke
    });
  }

  async linkOrCreateUser(whopUser: WhopUserInfo): Promise<User> {
    const whopUserId = whopUser.sub.trim();

    // 1. Check existing WhopIdentity mapping
    const existingIdentity = await this.userRepo.findWhopIdentityByWhopUserId(
      whopUserId,
    );
    if (existingIdentity?.user) {
      // Existing mapped user -> return directly
      return existingIdentity.user;
    }

    // 2. Check if a User already has this whopUserId on the user record
    const userByWhopId = await this.userRepo.findByWhopUserId(whopUserId);
    if (userByWhopId) {
      await this.userRepo
        .createWhopIdentity({
          userId: userByWhopId.id,
          whopUserId,
          email: whopUser.email,
        })
        .catch(() => {});
      return userByWhopId;
    }

    // 3. Safe Account Linking by Verified Email
    // Only link existing account if Whop confirms the email address is verified
    if (whopUser.email && whopUser.email_verified) {
      const emailLower = whopUser.email.toLowerCase().trim();
      const existingUserByEmail = await this.userRepo.findByEmail(emailLower);
      if (existingUserByEmail) {
        const linkedUser = await this.userRepo.linkWhopUser(
          existingUserByEmail.id,
          {
            whopUserId,
            emailVerified:
              existingUserByEmail.emailVerified || new Date(),
            image: existingUserByEmail.image || whopUser.picture || null,
          },
        );

        await this.userRepo
          .createWhopIdentity({
            userId: linkedUser.id,
            whopUserId,
            email: whopUser.email,
          })
          .catch(() => {});

        // Reconcile Whop entitlements in case they purchased prior to OAuth login
        await whopWebhookService
          .reconcileUserEntitlements(linkedUser.id, linkedUser.email)
          .catch(() => {});

        return (await this.userRepo.findById(linkedUser.id)) ?? linkedUser;
      }
    }

    // 4. Create New ResumeAI User linked to Whop Identity
    const normalizedEmail =
      whopUser.email?.toLowerCase().trim() || `${whopUserId}@users.whop.com`;

    // Ensure email is unique in rare edge case
    let targetEmail = normalizedEmail;
    const existing = await this.userRepo.findByEmail(targetEmail);
    if (existing) {
      targetEmail = `${whopUserId}-${Date.now()}@users.whop.com`;
    }

    // Generate unguessable random password hash so account cannot be accessed via empty/weak password
    const unguessablePassword = crypto.randomBytes(32).toString("hex");
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(unguessablePassword, salt);

    const name =
      whopUser.name?.trim() ||
      whopUser.preferred_username?.trim() ||
      "Whop User";

    const newUser = await this.userRepo.createWhopUser({
      email: targetEmail,
      name,
      passwordHash,
      whopUserId,
      emailVerified: whopUser.email_verified ? new Date() : null,
      image: whopUser.picture || null,
    });

    await this.userRepo
      .createWhopIdentity({
        userId: newUser.id,
        whopUserId,
        email: whopUser.email,
      })
      .catch(() => {});

    // Reconcile any existing subscription / entitlement
    await whopWebhookService
      .reconcileUserEntitlements(newUser.id, newUser.email)
      .catch(() => {});

    return (await this.userRepo.findById(newUser.id)) ?? newUser;
  }

  async authenticateFromCallback(params: {
    code: string;
    state: string;
    expectedState: string;
    codeVerifier: string;
    expectedNonce?: string;
    redirectUri: string;
  }): Promise<{ user: AuthUser; token: string; sessionId: string }> {
    // 1. Validate state matches strictly
    if (!params.state || params.state !== params.expectedState) {
      throw AppError.badRequest("Invalid OAuth state parameter (CSRF detected)");
    }

    // 2. Exchange authorization code for tokens
    const tokens = await this.exchangeCodeForTokens(
      params.code,
      params.codeVerifier,
      params.redirectUri,
    );

    // 3. If an id_token was provided, validate nonce
    if (tokens.id_token && params.expectedNonce) {
      try {
        const parts = tokens.id_token.split(".");
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], "base64url").toString(
            "utf8",
          );
          const payload = JSON.parse(payloadJson);
          if (payload.nonce && payload.nonce !== params.expectedNonce) {
            throw AppError.badRequest("OAuth ID token nonce mismatch");
          }
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
        // If unparseable, continue to userinfo
      }
    }

    // 4. Fetch Whop User Profile
    const whopUser = await this.fetchUserInfo(tokens.access_token);

    // 5. Link or create ResumeAI user
    const user = await this.linkOrCreateUser(whopUser);

    // 6. Create standard ResumeAI session (database session + JWT cookie)
    return this.auth.createSessionForUser(user);
  }
}

export const whopOAuthService = new WhopOAuthService();
