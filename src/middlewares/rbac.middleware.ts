import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';

// Role hierarchy — higher index = more permissions
const ROLE_HIERARCHY: UserRole[] = [
  UserRole.MR,
  UserRole.TRADE_REP,
  UserRole.DISTRIBUTOR_REP,
  UserRole.ASM,
  UserRole.RSM,
  UserRole.ZM,
  UserRole.NSM,
  UserRole.PRODUCT_MANAGER,
  UserRole.MARKETING,
  UserRole.SALES_ADMIN,
  UserRole.SUPER_ADMIN,
];

export const getRoleLevel = (role: UserRole): number => ROLE_HIERARCHY.indexOf(role);

/**
 * Middleware: allow only specific roles
 */
export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthenticated' });
    }
    if (!roles.includes(req.user.role as UserRole)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
};

/**
 * Middleware: allow roles at or above a minimum level
 */
export const requireMinRole = (minRole: UserRole) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthenticated' });
    }
    const userLevel = getRoleLevel(req.user.role as UserRole);
    const minLevel = getRoleLevel(minRole);
    if (userLevel < minLevel) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
};

/**
 * Middleware: allow managers (ASM and above)
 */
export const requireManager = requireMinRole(UserRole.ASM);

/**
 * Middleware: allow admin roles
 */
export const requireAdmin = requireRole(UserRole.SALES_ADMIN, UserRole.SUPER_ADMIN);
