import type { Request } from 'express';
import type { App, PlatformServiceType } from '@wapcentral/types';

export interface PlatformAuthenticatedRequest extends Request {
  platformApp?: App;
  platformRequestId?: string;
  requestedService?: PlatformServiceType;
}
