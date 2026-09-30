import type { Request } from 'express';

export interface GatewayAuthCaller {
  uid: string;
  appId?: string | undefined;
  email?: string | undefined;
  role?: string | undefined;
  isServiceAccount?: boolean | undefined;
}

export interface GatewayAuthenticatedRequest extends Request {
  caller?: GatewayAuthCaller | undefined;
}
