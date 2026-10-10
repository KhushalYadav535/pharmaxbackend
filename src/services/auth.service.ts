import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { env } from '../config/env';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  employeeId?: string;
}

export interface ClientMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceModel?: string;
  platform?: string;
  appVersion?: string;
}

const generateAccessToken = (userId: string, role: string, email: string) =>
  jwt.sign({ userId, role, email }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);

const generateRefreshToken = (userId: string) =>
  jwt.sign({ userId, jti: uuidv4() }, env.REFRESH_TOKEN_SECRET, { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN } as jwt.SignOptions);

export const authService = {
  async login(input: LoginInput, clientInfo?: ClientMetadata) {
    const identifier = input.email.trim().toLowerCase();
    const rawInput = input.email.trim();

    // Standard login by Email or Employee ID
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { employeeId: { equals: rawInput, mode: 'insensitive' } },
        ],
      },
      include: {
        hq: { select: { id: true, name: true, code: true } },
        territories: { include: { territory: true } },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) throw new Error('Invalid credentials');

    const accessToken = generateAccessToken(user.id, user.role, user.email);
    const refreshToken = generateRefreshToken(user.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastActiveAt: new Date() },
    });

    // Close any previous active session for this user
    await prisma.userSession.updateMany({
      where: { userId: user.id, status: 'ACTIVE' },
      data: { status: 'TIMED_OUT', logoutReason: 'NEW_LOGIN' },
    }).catch(() => {});

    // Create session record
    const session = await prisma.userSession.create({
      data: {
        userId: user.id,
        token: refreshToken,
        loginAt: new Date(),
        lastActiveAt: new Date(),
        status: 'ACTIVE',
        ipAddress: clientInfo?.ipAddress,
        userAgent: clientInfo?.userAgent,
        deviceModel: clientInfo?.deviceModel,
        platform: clientInfo?.platform || 'ANDROID',
        appVersion: clientInfo?.appVersion || '1.0.4',
      },
    }).catch(() => null);

    // Audit log entry
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'AUTH',
        entityId: session?.id,
        ipAddress: clientInfo?.ipAddress,
        userAgent: clientInfo?.userAgent,
      },
    }).catch(() => {});

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        profilePhoto: user.profilePhoto,
        employeeId: user.employeeId,
        hqId: user.hqId,
        hq: user.hq,
        territories: user.territories,
      },
    };
  },

  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) throw new Error('Email already registered');

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role as any,
        phone: input.phone,
        employeeId: input.employeeId,
      },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
      },
    });

    return user;
  },

  async refreshTokens(token: string) {
    const payload = jwt.verify(token, env.REFRESH_TOKEN_SECRET) as { userId: string };

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new Error('Invalid refresh token');
    }

    if (storedToken.isRevoked) {
      // Grace period for concurrent mobile requests: if rotated within last 30s, reuse active token
      const recentThreshold = new Date(Date.now() - 30 * 1000);
      if (storedToken.createdAt >= recentThreshold) {
        const activeToken = await prisma.refreshToken.findFirst({
          where: { userId: storedToken.userId, isRevoked: false, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
        });
        if (activeToken) {
          const newAccessToken = generateAccessToken(storedToken.user.id, storedToken.user.role, storedToken.user.email);
          return { accessToken: newAccessToken, refreshToken: activeToken.token };
        }
      }
      throw new Error('Invalid refresh token');
    }

    if (!storedToken.user.isActive) throw new Error('User inactive');

    const now = new Date();
    // Update lastActiveAt on token refresh
    await prisma.user.update({
      where: { id: storedToken.user.id },
      data: { lastActiveAt: now },
    }).catch(() => {});

    // Also update current active session duration
    const activeSession = await prisma.userSession.findFirst({
      where: { userId: storedToken.user.id, status: 'ACTIVE' },
      orderBy: { loginAt: 'desc' },
    });
    if (activeSession) {
      const durationMinutes = Math.max(1, Math.round((now.getTime() - activeSession.loginAt.getTime()) / 60000));
      await prisma.userSession.update({
        where: { id: activeSession.id },
        data: { lastActiveAt: now, durationMinutes },
      }).catch(() => {});
    }

    // Rotate refresh token
    await prisma.refreshToken.update({ where: { id: storedToken.id }, data: { isRevoked: true } });

    const newAccessToken = generateAccessToken(storedToken.user.id, storedToken.user.role, storedToken.user.email);
    const newRefreshToken = generateRefreshToken(storedToken.user.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: { token: newRefreshToken, userId: storedToken.user.id, expiresAt },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async logout(token?: string, userId?: string, reason?: string) {
    const now = new Date();
    let storedUserId = userId;

    if (token) {
      const stored = await prisma.refreshToken.findUnique({
        where: { token },
        select: { userId: true },
      });
      if (stored?.userId) storedUserId = stored.userId;

      await prisma.refreshToken.updateMany({
        where: { token },
        data: { isRevoked: true },
      }).catch(() => {});
    }

    // Find matching active or recent session
    const session = await prisma.userSession.findFirst({
      where: {
        OR: [
          token ? { token } : undefined,
          storedUserId ? { userId: storedUserId, status: 'ACTIVE' } : undefined,
        ].filter(Boolean) as any,
      },
      orderBy: { loginAt: 'desc' },
    });

    if (session) {
      const durationMinutes = Math.max(1, Math.round((now.getTime() - session.loginAt.getTime()) / 60000));
      await prisma.userSession.update({
        where: { id: session.id },
        data: {
          logoutAt: now,
          lastActiveAt: now,
          status: 'LOGGED_OUT',
          logoutReason: reason || 'MANUAL',
          durationMinutes,
        },
      }).catch(() => {});
    }

    if (storedUserId) {
      await prisma.user.update({
        where: { id: storedUserId },
        data: { lastLogoutAt: now },
      }).catch(() => {});

      await prisma.auditLog.create({
        data: {
          userId: storedUserId,
          action: 'LOGOUT',
          entity: 'AUTH',
          entityId: session?.id,
        },
      }).catch(() => {});
    }
  },

  async heartbeat(userId: string, clientInfo?: ClientMetadata) {
    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: now },
      select: { id: true, lastActiveAt: true },
    }).catch(() => {});

    let activeSession = await prisma.userSession.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { loginAt: 'desc' },
    });

    if (activeSession) {
      const durationMinutes = Math.max(1, Math.round((now.getTime() - activeSession.loginAt.getTime()) / 60000));
      await prisma.userSession.update({
        where: { id: activeSession.id },
        data: { lastActiveAt: now, durationMinutes },
      }).catch(() => {});
    } else {
      activeSession = await prisma.userSession.create({
        data: {
          userId,
          loginAt: now,
          lastActiveAt: now,
          status: 'ACTIVE',
          ipAddress: clientInfo?.ipAddress,
          userAgent: clientInfo?.userAgent,
          platform: clientInfo?.platform || 'ANDROID',
        },
      }).catch(() => null as any);
    }

    return { id: userId, lastActiveAt: now, sessionId: activeSession?.id };
  },


  async getMe(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, middleName: true, lastName: true, prefix: true, role: true,
        phone: true, employeeId: true, designation: true, department: true, grade: true, profilePhoto: true,
        dateOfJoining: true, qualification: true, gender: true, bloodGroup: true, maritalStatus: true,
        address1: true, address2: true, city: true, district: true, state: true, pin: true,
        whatsappNumber: true, dateOfBirth: true, marriageAnniversary: true,
        facebook: true, instagram: true, twitter: true, linkedin: true,
        spouseName: true, dependents: true, aadharNumber: true, panNumber: true,
        lastLoginAt: true, lastActiveAt: true, lastLogoutAt: true, createdAt: true,
        hqId: true,
        hq: { select: { id: true, name: true, code: true } },
        territories: { include: { territory: true } },
        manager: { select: { id: true, firstName: true, lastName: true, role: true, email: true } },
      },
    });
  },
};
