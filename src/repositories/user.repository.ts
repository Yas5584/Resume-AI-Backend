import { prisma, User, Session } from "@resumeai/database";

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
}

export const userRepository = new UserRepository();
