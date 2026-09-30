import type { GatewayRequest, GatewayResponse } from '@wapcentral/types';
import type { IProvider } from '@wapcentral/provider-sdk';
import {
  OpenAIProvider,
  GeminiProvider,
  AnthropicProvider,
  SelfHostedProvider,
  ProviderError,
} from '@wapcentral/provider-sdk';
import { getPolicy, checkQuotas, incrementUsage, isProviderKillSwitched } from './policyEngine.js';
import { recordUsage } from './usageRecorder.js';
import { config } from '../config.js';

// Provider adapter cache / factory
const providerAdapterMap = new Map<string, IProvider>();

export function registerMockAdapter(providerId: string, adapter: IProvider): void {
  providerAdapterMap.set(providerId, adapter);
}

export function clearMockAdapters(): void {
  providerAdapterMap.clear();
}

function getProviderAdapter(providerId: string): IProvider {
  if (providerAdapterMap.has(providerId)) {
    return providerAdapterMap.get(providerId)!;
  }

  // Create real provider adapters
  let adapter: IProvider;
  switch (providerId) {
    case 'openai':
      adapter = new OpenAIProvider({
        apiKey: process.env['OPENAI_API_KEY'],
        timeoutMs: config.defaultTimeoutMs,
      });
      break;
    case 'gemini':
      adapter = new GeminiProvider({
        apiKey: process.env['GEMINI_API_KEY'],
        timeoutMs: config.defaultTimeoutMs,
      });
      break;
    case 'anthropic':
      adapter = new AnthropicProvider({
        apiKey: process.env['ANTHROPIC_API_KEY'],
        timeoutMs: config.defaultTimeoutMs,
      });
      break;
    default:
      adapter = new SelfHostedProvider({
        baseUrl: process.env['SELF_HOSTED_BASE_URL'] || 'http://localhost:11434',
        apiKey: process.env['SELF_HOSTED_AI_CREDENTIALS'],
        timeoutMs: config.defaultTimeoutMs,
      });
      break;
  }

  providerAdapterMap.set(providerId, adapter);
  return adapter;
}

export interface RouterExecutionResult {
  statusCode: number;
  response?: GatewayResponse | undefined;
  error?:
    | {
        code: string;
        message: string;
        details?: unknown;
      }
    | undefined;
}

export async function executeGatewayRequest(req: GatewayRequest): Promise<RouterExecutionResult> {
  const startTime = Date.now();

  // 1. Resolve Policy
  const policy = getPolicy(req.appId, req.feature);
  if (!policy) {
    return {
      statusCode: 404,
      error: {
        code: 'POLICY_NOT_FOUND',
        message: `No active routing policy found for appId '${req.appId}' and feature '${req.feature}'.`,
      },
    };
  }

  // 2. Estimate input tokens
  let promptLength = req.payload.prompt?.length || 0;
  if (req.payload.messages) {
    promptLength += req.payload.messages.reduce((acc, m) => acc + m.content.length, 0);
  }
  const estimatedInputTokens = Math.ceil(promptLength / 4);

  // 3. Quota & Kill Switch Evaluation
  const quotaCheck = checkQuotas(policy, estimatedInputTokens);
  if (!quotaCheck.allowed) {
    const isKillSwitch =
      quotaCheck.code === 'KILL_SWITCH_ACTIVE' || quotaCheck.code === 'POLICY_DISABLED';
    return {
      statusCode: isKillSwitch ? 503 : 429,
      error: {
        code: quotaCheck.code || 'QUOTA_EXCEEDED',
        message: quotaCheck.reason || 'Quota check failed',
      },
    };
  }

  // 4. Build Candidate Execution Chain
  interface Candidate {
    providerId: string;
    modelId: string;
    tier: number;
  }

  const candidates: Candidate[] = [
    {
      providerId: policy.primaryProviderId,
      modelId: req.modelPreference || policy.primaryModelId,
      tier: 0,
    },
    ...policy.fallbackChain
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((fb) => ({
        providerId: fb.providerId,
        modelId: fb.modelId,
        tier: fb.priority,
      })),
  ];

  let lastError: Error | null = null;

  // 5. Route Execution with Fallback Chain
  for (const candidate of candidates) {
    // Check if this provider has an emergency provider-level kill switch
    if (isProviderKillSwitched(candidate.providerId)) {
      continue;
    }

    try {
      const adapter = getProviderAdapter(candidate.providerId);
      let gatewayRes: GatewayResponse;

      if (req.payload.type === 'analyze_image' && req.payload.imageData) {
        gatewayRes = await adapter.analyzeImage({
          modelId: candidate.modelId,
          payload: req.payload,
          timeoutMs: config.defaultTimeoutMs,
        });
      } else {
        gatewayRes = await adapter.generate({
          modelId: candidate.modelId,
          payload: req.payload,
          timeoutMs: config.defaultTimeoutMs,
        });
      }

      // Successful Execution
      const latencyMs = Date.now() - startTime;
      const inputTokens = gatewayRes.usage?.inputTokens || estimatedInputTokens;
      const outputTokens = gatewayRes.usage?.outputTokens || 0;

      // Increment internal quota counters
      incrementUsage(req.appId, req.feature, inputTokens, outputTokens);

      // Async, non-blocking telemetry write
      recordUsage({
        appId: req.appId,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        feature: req.feature,
        requestId: req.requestId,
        inputTokens,
        outputTokens,
        costEstimateUsd: gatewayRes.costEstimate?.amountUsd,
        latencyMs,
        success: true,
      });

      return {
        statusCode: 200,
        response: {
          ...gatewayRes,
          requestId: req.requestId,
          latencyMs,
        },
      };
    } catch (err: unknown) {
      lastError = err as Error;
      // Record failure attempt asynchronously
      recordUsage({
        appId: req.appId,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        feature: req.feature,
        requestId: req.requestId,
        latencyMs: Date.now() - startTime,
        success: false,
        error: (err as Error).message,
      });

      // Continue to next fallback candidate in chain
    }
  }

  // 6. All Candidates Failed
  const isTimeout =
    lastError instanceof ProviderError
      ? lastError.code === 'TIMEOUT'
      : lastError?.message.includes('timeout');

  return {
    statusCode: isTimeout ? 504 : 502,
    error: {
      code: isTimeout ? 'GATEWAY_TIMEOUT' : 'BAD_GATEWAY',
      message: `All AI providers failed in routing chain: ${lastError?.message || 'Unknown error'}`,
    },
  };
}
