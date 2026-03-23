import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

const JWT_SECRET = (process.env.JWT_SECRET || 'your-secret-key').trim();
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '365d').trim();

export interface TokenPayload {
  userId: string;
  employeeId: string;
  email: string;
  role: Role;
}

export interface AuthUser extends TokenPayload {
  employeeDbId?: string;
  departmentId?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

export function isAdmin(role: Role): boolean {
  return role === 'ADMIN';
}

export function isHR(role: Role): boolean {
  return role === 'HR';
}

export function isManager(role: Role): boolean {
  return role === 'MANAGER';
}

export function isAdminOrHR(role: Role): boolean {
  return role === 'ADMIN' || role === 'HR';
}

export function canApproveLeave(role: Role): boolean {
  return role === 'ADMIN' || role === 'HR' || role === 'MANAGER';
}

export function canManagePayroll(role: Role): boolean {
  return role === 'ADMIN' || role === 'HR';
}

export function canViewAllAttendance(role: Role): boolean {
  return role === 'ADMIN' || role === 'HR';
}

export function canManageTaxSlabs(role: Role): boolean {
  return role === 'ADMIN';
}

export function canManageLateRules(role: Role): boolean {
  return role === 'ADMIN';
}

export function canViewActivityLogs(role: Role): boolean {
  return role === 'ADMIN' || role === 'HR';
}
