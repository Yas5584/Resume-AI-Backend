import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  userRepository,
  UserRepository,
} from "../repositories/user.repository.js";
import { env } from "../config/index.js";
import { AppError } from "../errors/index.js";
import { RegisterRequest, LoginRequest, AuthUser } from "@resumeai/shared";
import { User } from "@resumeai/database";
import { whopWebhookService } from "./whop-webhook.service.js";

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "USER" | "ADMIN",
    subscriptionTier: user.subscriptionTier as "FREE" | "PRO" | "ENTERPRISE",
    creditsBalance: user.creditsBalance,
    image: user.image ?? null,
    emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

function parseExpiresInToMs(durationStr: string): number {
  const match = durationStr.match(/^(\d+)([smhdwy])?$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "s":
      return val * 1000;
    case "m":
      return val * 60 * 1000;
    case "h":
      return val * 60 * 60 * 1000;
    case "d":
      return val * 24 * 60 * 60 * 1000;
    case "w":
      return val * 7 * 24 * 60 * 60 * 1000;
    case "y":
      return val * 365 * 24 * 60 * 60 * 1000;
    default:
      return val * 1000;
  }
}

export class AuthService {
  constructor(private userRepo: UserRepository = userRepository) {}

  async register(
    data: RegisterRequest,
  ): Promise<{ user: AuthUser; token: string; sessionId: string }> {
    const email = data.email.toLowerCase().trim();
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw AppError.conflict("An account with this email already exists");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    let user = await this.userRepo.create({
      email,
      name: data.name.trim(),
      passwordHash,
    });

    // Reconcile any Whop subscription created before registration
    await whopWebhookService
      .reconcileUserEntitlements(user.id, user.email)
      .catch(() => {});
    user = (await this.userRepo.findById(user.id)) ?? user;

    return this.createSessionForUser(user);
  }

  async login(
    data: LoginRequest,
  ): Promise<{ user: AuthUser; token: string; sessionId: string }> {
    const email = data.email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw AppError.unauthorized("Invalid email or password");
    }

    const validPassword = await bcrypt.compare(
      data.password,
      user.passwordHash,
    );
    if (!validPassword) {
      throw AppError.unauthorized("Invalid email or password");
    }

    return this.createSessionForUser(user);
  }

  async createSessionForUser(
    user: User,
  ): Promise<{ user: AuthUser; token: string; sessionId: string }> {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + parseExpiresInToMs(env.JWT_EXPIRES_IN),
    );

    await this.userRepo.createSession({
      userId: user.id,
      token: sessionId,
      expiresAt,
    });

    const token = this.generateToken(user.id, user.email, user.role, sessionId);

    return {
      user: toAuthUser(user),
      token,
      sessionId,
    };
  }

  async logout(
    sessionId?: string,
    token?: string,
    userId?: string,
  ): Promise<void> {
    if (sessionId) {
      await this.userRepo.deleteSessionById(sessionId);
      await this.userRepo.deleteSessionByToken(sessionId);
    }
    if (token) {
      await this.userRepo.deleteSessionByToken(token);
    }
    if (userId) {
      await this.userRepo.deleteUserSessions(userId);
    }
  }

  async getProfile(userId: string): Promise<AuthUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw AppError.notFound("User");
    }

    return toAuthUser(user);
  }

  private generateToken(
    id: string,
    email: string,
    role: string,
    sessionId: string,
  ): string {
    return jwt.sign({ id, email, role, sessionId }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    });
  }
}

export const authService = new AuthService();
