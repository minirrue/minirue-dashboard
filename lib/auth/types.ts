/** Mirrors `knowledge/specs/001-auth-backend/contracts/auth-api.yaml` */

import type { Role } from './role';

export type { Role } from './role';

export interface UserProfile {
  userId: string;
  role: Role;
  email: string;
  /** First-name-only greeting form (business rule: everyone is addressed by
   *  their first name). NOT the whole stored name — use `fullName` for that,
   *  e.g. an editable "your name" field. See auth.controller.ts's `me()`. */
  name?: string;
  /** The complete stored name, untouched. Absent on older cached responses
   *  that predate this field — callers editing a name must fall back to
   *  `name` in that case. */
  fullName?: string;
  avatarUrl?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/**
 * What a successful sign-in gives the client.
 *
 * No longer extends TokenPair. Better Auth's session is an httpOnly cookie —
 * there is no access or refresh token for a caller to hold, and returning empty
 * strings shaped like credentials would be worse than dropping the fields.
 * `user` is the only one any call site ever read.
 *
 * TokenPair itself survives for "sign in as", which really does mint a
 * short-lived bearer token rather than swapping the session cookie.
 */
export interface AuthSuccessResponse {
  user: UserProfile;
}

export type MeResponse = UserProfile;
