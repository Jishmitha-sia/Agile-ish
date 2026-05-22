import { z } from 'zod';

import { UserId, WorkspaceId, WorkspaceRole } from './common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Password policy — enforced on signup and password change.
// Tunable here so policy lives in one place across web + api.
// ─────────────────────────────────────────────────────────────────────────────

export const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((v) => /[a-z]/.test(v), 'Must contain a lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Must contain an uppercase letter')
  .refine((v) => /[0-9]/.test(v), 'Must contain a digit');

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address')
  .max(254);

// ─────────────────────────────────────────────────────────────────────────────
// Signup
// ─────────────────────────────────────────────────────────────────────────────

export const SignupRequest = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  displayName: z.string().trim().min(1).max(80),
  // Optional name for the auto-created personal workspace.
  workspaceName: z.string().trim().min(1).max(80).optional(),
});
export type SignupRequest = z.infer<typeof SignupRequest>;

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

export const LoginRequest = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

// ─────────────────────────────────────────────────────────────────────────────
// Session response — returned by /auth/signup, /auth/login, /auth/refresh.
// The refresh token is delivered via httpOnly cookie, NEVER in the body.
// ─────────────────────────────────────────────────────────────────────────────

export const AuthenticatedUser = z.object({
  id: UserId,
  email: EmailSchema,
  displayName: z.string(),
  avatarUrl: z.string().url().nullable(),
  emailVerifiedAt: z.string().datetime().nullable(),
  defaultWorkspaceId: WorkspaceId.nullable(),
  memberships: z.array(
    z.object({
      workspaceId: WorkspaceId,
      workspaceSlug: z.string(),
      role: WorkspaceRole,
    }),
  ),
});
export type AuthenticatedUser = z.infer<typeof AuthenticatedUser>;

export const SessionResponse = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.string().datetime(),
  user: AuthenticatedUser,
});
export type SessionResponse = z.infer<typeof SessionResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// JWT claims shape — what we put in the access token.
// Keep this minimal: anything that changes often (memberships, role) is fetched
// fresh from /auth/me, not embedded in the JWT.
// ─────────────────────────────────────────────────────────────────────────────

export const AccessTokenClaims = z.object({
  sub: UserId,
  email: EmailSchema,
  sid: z.string(), // session id — links access token to a refresh-token family
  iat: z.number().int(),
  exp: z.number().int(),
  iss: z.string(),
  aud: z.union([z.string(), z.array(z.string())]),
});
export type AccessTokenClaims = z.infer<typeof AccessTokenClaims>;

// ─────────────────────────────────────────────────────────────────────────────
// Password change
// ─────────────────────────────────────────────────────────────────────────────

export const ChangePasswordRequest = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: PasswordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must differ from current password',
    path: ['newPassword'],
  });
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;
