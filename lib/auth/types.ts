/** Mirrors `knowledge/specs/001-auth-backend/contracts/auth-api.yaml` */

import type { Role } from './role';

export type { Role } from './role';

export interface UserProfile {
  userId: string;
  role: Role;
  email: string;
  name?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthSuccessResponse extends TokenPair {
  user: UserProfile;
}

export type MeResponse = UserProfile;
