import type { UserRole } from '@wapcentral/types';
import type { Request } from 'express';

export interface AuthUser {
  uid: string;
  email: string;
  role: UserRole;
  token?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
