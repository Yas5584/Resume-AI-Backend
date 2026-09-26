import { prisma, User, Session, WhopIdentity } from "@resumeai/database";

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async create(data: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        name: data.name.trim(),
        passwordHash: data.passwordHash,
      },
    });
  }

  async updateProfile(
    userId: string,
    data: { name?: string; image?: string | null },
  ): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.image !== undefined ? { image: data.image } : {}),
      },
    });
  }

  async updateCredits(userId: string, creditsChange: number): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        creditsBalance: { increment: creditsChange },
      },
    });
  }

  // Session Management
  async createSession(data: {
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<Session> {
    return prisma.session.create({
      data: {
        userId: data.userId,
        token: data.token,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findSessionByToken(
    token: string,
  ): Promise<(Session & { user: User }) | null> {
    return prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async deleteSessionByToken(token: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { token },
    });
  }

  async deleteSessionById(id: string): Promise<void> {
    await prisma.session.deleteMany({
      where: {
        OR: [{ id }, { token: id }],
      },
    });
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { userId },
    });
  }

  // Whop Identity Management
  async findWhopIdentityByWhopUserId(
    whopUserId: string,
  ): Promise<(WhopIdentity & { user: User }) | null> {
    return prisma.whopIdentity.findUnique({
      where: { whopUserId },
      include: { user: true },
    });
  }

  async findByWhopUserId(whopUserId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { whopUserId },
    });
  }

  async createWhopIdentity(data: {
    userId: string;
    whopUserId: string;
    email?: string | null;
  }): Promise<WhopIdentity> {
    return prisma.whopIdentity.create({
      data: {
        userId: data.userId,
        whopUserId: data.whopUserId,
        email: data.email ?? null,
      },
    });
  }

  async createWhopUser(data: {
    email: string;
    name: string;
    passwordHash: string;
    whopUserId: string;
    emailVerified?: Date | null;
    image?: string | null;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        name: data.name.trim(),
        passwordHash: data.passwordHash,
        whopUserId: data.whopUserId,
        emailVerified: data.emailVerified,
        image: data.image,
      },
    });
  }

  async linkWhopUser(
    userId: string,
    data: {
      whopUserId: string;
      emailVerified?: Date | null;
      image?: string | null;
    },
  ): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        whopUserId: data.whopUserId,
        ...(data.emailVerified ? { emailVerified: data.emailVerified } : {}),
        ...(data.image ? { image: data.image } : {}),
      },
    });
  }
}

export const userRepository = new UserRepository();
