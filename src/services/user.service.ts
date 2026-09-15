import {
  userRepository,
  UserRepository,
} from "../repositories/user.repository.js";
import { AppError } from "../errors/index.js";
import { UpdateProfileRequest, UserProfileResponse } from "@resumeai/shared";
import { User } from "@resumeai/database";

function toUserProfile(user: User): UserProfileResponse {
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

export class UserService {
  constructor(private userRepo: UserRepository = userRepository) {}

  async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw AppError.notFound("User");
    }
    return toUserProfile(user);
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileRequest,
  ): Promise<UserProfileResponse> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw AppError.notFound("User");
    }

    const updated = await this.userRepo.updateProfile(userId, {
      name: data.name,
    });

    return toUserProfile(updated);
  }
}

export const userService = new UserService();
