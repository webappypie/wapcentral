import type { IProvider } from '@wapcentral/provider-sdk';
import {
  OpenAIProvider,
  GeminiProvider,
  AnthropicProvider,
  SelfHostedProvider,
  ProviderError,
} from '@wapcentral/provider-sdk';
import type { CircuitBreakerConfig, GatewayRequest, GatewayResponse } from '@wapcentral/types';

import { circuitBreaker } from './circuitBreaker.js';
import {
  getPolicy,
  checkQuotas,
  incrementUsage,
  isProviderKillSwitched,
  syncPoliciesFromFirestore,
} from './policyEngine.js';
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

export function getProviderAdapter(providerId: string): IProvider {
  const cached = providerAdapterMap.get(providerId);
  if (cached) {
    return cached;
  }

  // Create real provider adapters
  let adapter: IProvider;
  if (providerId.startsWith('openai') || providerId === 'openai') {
    adapter = new OpenAIProvider(
      {
        apiKey: process.env['OPENAI_API_KEY'],
        timeoutMs: config.defaultTimeoutMs,
      },
      providerId,
    );
  } else if (providerId.startsWith('gemini') || providerId === 'gemini') {
    adapter = new GeminiProvider(
      {
        apiKey: process.env['GEMINI_API_KEY'],
        timeoutMs: config.defaultTimeoutMs,
      },
      providerId,
    );
  } else if (providerId.startsWith('anthropic') || providerId.startsWith('claude')) {
    adapter = new AnthropicProvider(
      {
        apiKey: process.env['ANTHROPIC_API_KEY'],
        timeoutMs: config.defaultTimeoutMs,
      },
      providerId,
    );
  } else {
    adapter = new SelfHostedProvider(
      {
        baseUrl: process.env['SELF_HOSTED_BASE_URL'] || 'http://localhost:11434',
        apiKey: process.env['SELF_HOSTED_AI_CREDENTIALS'],
        timeoutMs: config.defaultTimeoutMs,
      },
      providerId,
    );
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

  // Ensure policies are synchronized from Firestore if not in test
  if (process.env['NODE_ENV'] !== 'test') {
    await syncPoliciesFromFirestore();
  }

  // 1. Resolve Policy based on App and Feature with Priority
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

  // 3. Quota, Rate Limit & Kill Switch Evaluation
  const quotaCheck = checkQuotas(policy, estimatedInputTokens);
  if (!quotaCheck.allowed) {
    let statusCode = 429;
    if (quotaCheck.code === 'KILL_SWITCH_ACTIVE' || quotaCheck.code === 'POLICY_DISABLED') {
      statusCode = 503;
    } else if (quotaCheck.code === 'TOKEN_LIMIT_EXCEEDED') {
      statusCode = 400;
    }

    return {
      statusCode,
      error: {
        code: quotaCheck.code || 'QUOTA_EXCEEDED',
        message: quotaCheck.reason || 'Quota check failed',
      },
    };
  }

  // 4. Circuit Breaker Configuration
  const cbConfig: CircuitBreakerConfig = {
    failureThreshold: policy.circuitBreaker?.failureThreshold ?? 3,
    timeoutMs: policy.circuitBreaker?.timeoutMs ?? config.defaultTimeoutMs,
    recoveryTimeMs: policy.circuitBreaker?.recoveryTimeMs ?? 30000,
  };

  // 5. Build Candidate Execution Chain
  // Primary route always candidate 0; fallback candidates only if configured!
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
  ];

  // Automatic fallback only when configured
  if (policy.fallbackChain && policy.fallbackChain.length > 0) {
    const sortedFallbacks = policy.fallbackChain
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((fb) => ({
        providerId: fb.providerId,
        modelId: fb.modelId,
        tier: fb.priority,
      }));
    candidates.push(...sortedFallbacks);
  }

  let lastError: Error | null = null;

  // 6. Route Execution with Fallback Chain & Circuit Breakers
  for (const candidate of candidates) {
    // Check provider-level emergency kill switch
    if (isProviderKillSwitched(candidate.providerId)) {
      continue;
    }

    // Check circuit breaker status
    const cbKey = `${policy.id}:${candidate.providerId}:${candidate.modelId}`;
    const cbCheck = circuitBreaker.canExecute(cbKey, cbConfig);

    if (!cbCheck.allowed) {
      // Circuit is OPEN: skip this provider immediately and failover
      lastError = new Error(cbCheck.reason || `Circuit breaker open for ${candidate.providerId}`);
      continue;
    }

    try {
      const adapter = getProviderAdapter(candidate.providerId);
      const executionTimeoutMs = cbConfig.timeoutMs;

      // Wrap adapter call with timeout promise
      let timeoutHandle: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            new ProviderError(
              candidate.providerId,
              'TIMEOUT',
              `Request timed out after ${executionTimeoutMs}ms on provider '${candidate.providerId}'`,
            ),
          );
        }, executionTimeoutMs);
      });

      const adapterPromise =
        req.payload.type === 'analyze_image' && req.payload.imageData
          ? adapter.analyzeImage({
              modelId: candidate.modelId,
              payload: req.payload,
              timeoutMs: executionTimeoutMs,
            })
          : adapter.generate({
              modelId: candidate.modelId,
              payload: req.payload,
              timeoutMs: executionTimeoutMs,
            });

      const gatewayRes: GatewayResponse = await Promise.race([adapterPromise, timeoutPromise]).finally(
        () => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
        },
      );

      // Successful Execution
      const latencyMs = Date.now() - startTime;
      const inputTokens = gatewayRes.usage?.inputTokens || estimatedInputTokens;
      const outputTokens = gatewayRes.usage?.outputTokens || 0;

      // Report success to Circuit Breaker (resets failure count / transitions half-open to closed)
      circuitBreaker.recordSuccess(cbKey);

      // Increment internal quota and rate-limiting counters
      incrementUsage(req.appId, req.feature, inputTokens, outputTokens, policy.id);

      // Async, non-blocking telemetry write to real Firestore
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

      // Record failure in Circuit Breaker (trips to OPEN if threshold exceeded)
      circuitBreaker.recordFailure(cbKey, (err as Error).message, cbConfig);

      // Record failure attempt asynchronously to Firestore
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

      // Continue to next fallback candidate in chain (if configured)
    }
  }

  // 7. All Candidates Failed
  const isTimeout =
    lastError instanceof ProviderError
      ? lastError.code === 'TIMEOUT'
      : lastError?.message.includes('timed out') || lastError?.message.includes('timeout');

  return {
    statusCode: isTimeout ? 504 : 502,
    error: {
      code: isTimeout ? 'GATEWAY_TIMEOUT' : 'BAD_GATEWAY',
      message: `All AI providers failed in routing chain: ${lastError?.message || 'Unknown error'}`,
    },
  };
}
