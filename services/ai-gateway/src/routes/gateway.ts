import { Router } from 'express';
import type { Response } from 'express';
import type { GatewayAuthenticatedRequest } from '../types/auth.js';
import { authenticateGateway } from '../middleware/auth.js';
import { GatewayRequestSchema } from '@wapcentral/validation';
import { executeGatewayRequest } from '../services/router.js';
import {
  setGlobalKillSwitch,
  setProviderKillSwitch,
  isGlobalKillSwitchActive,
} from '../services/policyEngine.js';
import { getUsageEvents } from '../services/usageRecorder.js';

export const gatewayRouter: Router = Router();

// POST /v1/gateway - Main AI Gateway endpoint
gatewayRouter.post(
  '/',
  authenticateGateway,
  async (req: GatewayAuthenticatedRequest, res: Response) => {
    const parsed = GatewayRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid gateway request format',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await executeGatewayRequest(parsed.data);

    if (result.error) {
      res.status(result.statusCode).json({
        success: false,
        error: result.error,
        requestId: parsed.data.requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.response,
      timestamp: new Date().toISOString(),
    });
  },
);

// POST /v1/gateway/kill-switch - Emergency global or provider kill switch
gatewayRouter.post(
  '/kill-switch',
  authenticateGateway,
  (req: GatewayAuthenticatedRequest, res: Response) => {
    const { global, providerId, disabled } = req.body as {
      global?: boolean;
      providerId?: string;
      disabled?: boolean;
    };

    if (global !== undefined) {
      setGlobalKillSwitch(!!disabled);
    }

    if (providerId) {
      setProviderKillSwitch(providerId, !!disabled);
    }

    res.json({
      success: true,
      data: {
        globalKillSwitch: isGlobalKillSwitchActive(),
        providerId: providerId || null,
        disabled: !!disabled,
      },
      timestamp: new Date().toISOString(),
    });
  },
);

// GET /v1/gateway/telemetry - Query recent in-memory telemetry events
gatewayRouter.get(
  '/telemetry',
  authenticateGateway,
  (req: GatewayAuthenticatedRequest, res: Response) => {
    const appId = req.query['appId'] ? String(req.query['appId']) : undefined;
    const events = getUsageEvents(appId);

    res.json({
      success: true,
      data: events,
      total: events.length,
      timestamp: new Date().toISOString(),
    });
  },
);
