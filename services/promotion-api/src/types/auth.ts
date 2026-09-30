import type { Request } from 'express';

export interface AppCaller {
  appId: string;
  appKey: string;
  appName: string;
}

export interface AppAuthenticatedRequest extends Request {
  appCaller?: AppCaller;
}
