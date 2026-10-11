import type { ChatMessage } from '@wapcentral/types';
import { GatewayRequestSchema, AiPlaygroundRequestSchema } from '@wapcentral/validation';
import { Router } from 'express';
import type { Response } from 'express';

import { config } from '../config.js';
import { authenticateGateway } from '../middleware/auth.js';
import {
  setGlobalKillSwitch,
  setProviderKillSwitch,
  isGlobalKillSwitchActive,
} from '../services/policyEngine.js';
import { executeGatewayRequest, getProviderAdapter } from '../services/router.js';
import { getUsageEvents, recordUsage } from '../services/usageRecorder.js';
import type { GatewayAuthenticatedRequest } from '../types/auth.js';

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
    const appId = typeof req.query['appId'] === 'string' ? req.query['appId'] : undefined;
    const events = getUsageEvents(appId);

    res.json({
      success: true,
      data: events,
      total: events.length,
      timestamp: new Date().toISOString(),
    });
  },
);

// POST /v1/gateway/playground - Real inference endpoint for AI Playground
gatewayRouter.post(
  '/playground',
  authenticateGateway,
  async (req: GatewayAuthenticatedRequest, res: Response) => {
    if (req.caller?.role && req.caller.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: "AI Playground requires 'super_admin' access.",
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const parsed = AiPlaygroundRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid AI Playground request format',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { providerId, modelId, prompt, systemPrompt, temperature, maxTokens } = parsed.data;
    const startTime = Date.now();
    const requestId = `pg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      const adapter = getProviderAdapter(providerId);

      const messages: ChatMessage[] = [];
      if (systemPrompt && systemPrompt.trim().length > 0) {
        messages.push({ role: 'system', content: systemPrompt.trim() });
      }
      messages.push({ role: 'user', content: prompt.trim() });

      const gatewayRes = await adapter.generate({
        modelId,
        payload: {
          type: 'generate',
          prompt: prompt.trim(),
          messages,
          ...(maxTokens ? { maxTokens } : {}),
          ...(temperature !== undefined ? { temperature } : {}),
        },
        timeoutMs: config.defaultTimeoutMs,
      });

      const latencyMs = gatewayRes.latencyMs || (Date.now() - startTime);
      const inputTokens = gatewayRes.usage?.inputTokens ?? Math.ceil(prompt.length / 4);
      const outputTokens = gatewayRes.usage?.outputTokens ?? Math.ceil(gatewayRes.content.length / 4);
      const totalTokens = gatewayRes.usage?.totalTokens ?? (inputTokens + outputTokens);
      const costEstimate =
        gatewayRes.costEstimate ||
        adapter.estimateCost({
          inputTokens,
          outputTokens,
          modelId,
        });

      // Record async usage telemetry
      recordUsage({
        appId: req.caller?.appId || 'wapcentral_admin',
        providerId,
        modelId,
        feature: 'ai_playground',
        requestId,
        inputTokens,
        outputTokens,
        costEstimateUsd: costEstimate.amountUsd,
        latencyMs,
        success: true,
      });

      res.status(200).json({
        success: true,
        data: {
          requestId,
          providerId,
          modelId,
          content: gatewayRes.content,
          usage: {
            inputTokens,
            outputTokens,
            totalTokens,
          },
          costEstimate,
          latencyMs,
          raw: {
            requestId,
            providerId,
            modelId,
            content: gatewayRes.content,
            usage: {
              inputTokens,
              outputTokens,
              totalTokens,
            },
            costEstimate,
            latencyMs,
            cached: gatewayRes.cached ?? false,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      recordUsage({
        appId: req.caller?.appId || 'wapcentral_admin',
        providerId,
        modelId,
        feature: 'ai_playground',
        requestId,
        latencyMs,
        success: false,
        error: errorMsg,
      });

      res.status(502).json({
        success: false,
        error: {
          code: 'BAD_GATEWAY',
          message: `Inference failed on provider '${providerId}': ${errorMsg}`,
        },
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  },
);
