import type {
  DetailedServiceHealth,
  AiServerMetrics,
  InfrastructureAlertRule,
  InfrastructureAlertTrigger,
  PlatformHealthOverview,
  HealthStatusLevel,
  ServiceCategory,
} from '@wapcentral/types';
import { HEALTH_MONITORING } from '@wapcentral/config';

// ============================================================
// Service Definitions
// ============================================================

export interface ServiceDefinition {
  id: string;
  name: string;
  category: ServiceCategory;
  region: string;
  endpoint?: string;
  expectedBaselineLatencyMs: number;
  details?: Record<string, unknown>;
}

export const DEFAULT_MONITORED_SERVICES: ServiceDefinition[] = [
  {
    id: 'admin-api',
    name: 'Admin Control API',
    category: 'api',
    region: 'us-central1 (Cloud Run)',
    endpoint: 'http://localhost:8080/health',
    expectedBaselineLatencyMs: 35,
    details: { service: 'admin-api', version: '0.6.0' },
  },
  {
    id: 'promotion-api',
    name: 'Promotion Delivery API',
    category: 'api',
    region: 'us-central1 (Cloud Run)',
    endpoint: 'http://localhost:8081/v1/health',
    expectedBaselineLatencyMs: 25,
    details: { service: 'promotion-api', version: '0.6.0' },
  },
  {
    id: 'ai-gateway',
    name: 'AI Routing Gateway',
    category: 'api',
    region: 'us-central1 (Cloud Run)',
    endpoint: 'http://localhost:8082/v1/health',
    expectedBaselineLatencyMs: 65,
    details: { service: 'ai-gateway', version: '0.6.0' },
  },
  {
    id: 'workers',
    name: 'Background Workers Cluster',
    category: 'worker',
    region: 'us-central1 (Cloud Run)',
    endpoint: 'internal://workers',
    expectedBaselineLatencyMs: 15,
    details: { role: 'usage-aggregation & health-monitoring' },
  },
  {
    id: 'firestore',
    name: 'Firestore Database',
    category: 'infrastructure',
    region: 'nam5 (us-central multi-region)',
    endpoint: 'internal://firestore',
    expectedBaselineLatencyMs: 22,
    details: { type: 'NoSQL Multi-Region Datastore', tier: 'Enterprise' },
  },
  {
    id: 'cloud_storage',
    name: 'Firebase Cloud Storage',
    category: 'infrastructure',
    region: 'us-central1',
    endpoint: 'internal://storage',
    expectedBaselineLatencyMs: 18,
    details: { type: 'Creative Assets CDN & Bucket' },
  },
  {
    id: 'secret_manager',
    name: 'Google Cloud Secret Manager',
    category: 'infrastructure',
    region: 'global',
    endpoint: 'internal://secretmanager',
    expectedBaselineLatencyMs: 16,
    details: { type: 'Cryptographic Key Vault', envelopeEncryption: true },
  },
  {
    id: 'gemini',
    name: 'Google Gemini AI',
    category: 'ai_provider',
    region: 'global (Google Cloud)',
    endpoint: 'https://generativelanguage.googleapis.com',
    expectedBaselineLatencyMs: 110,
    details: { providerType: 'gemini', models: ['gemini-1.5-flash', 'gemini-1.5-pro'] },
  },
  {
    id: 'openai',
    name: 'OpenAI API',
    category: 'ai_provider',
    region: 'global',
    endpoint: 'https://api.openai.com',
    expectedBaselineLatencyMs: 145,
    details: { providerType: 'openai', models: ['gpt-4o', 'gpt-4o-mini'] },
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude API',
    category: 'ai_provider',
    region: 'global',
    endpoint: 'https://api.anthropic.com',
    expectedBaselineLatencyMs: 160,
    details: { providerType: 'anthropic', models: ['claude-3-5-sonnet', 'claude-3-haiku'] },
  },
  {
    id: 'self_hosted',
    name: 'Self-Hosted AI Node (vLLM)',
    category: 'ai_server',
    region: 'us-central1-a (A100 GPU)',
    endpoint: 'http://localhost:8000/health',
    expectedBaselineLatencyMs: 45,
    details: { engine: 'vLLM', gpu: 'NVIDIA A100-SXM4-80GB', model: 'llama-3.1-8b-instruct' },
  },
];

// ============================================================
// Service Heartbeat Prober
// ============================================================

export interface ProbeOptions {
  timeoutMs?: number | undefined;
  fetchFn?: typeof fetch | undefined;
  simulatedStatus?: HealthStatusLevel | undefined;
  simulatedLatencyMs?: number | undefined;
  simulatedError?: string | undefined;
  previousHealth?: DetailedServiceHealth | undefined;
}

/**
 * Probes the heartbeat of a single service and produces a DetailedServiceHealth record.
 */
export async function probeServiceHeartbeat(
  def: ServiceDefinition,
  options: ProbeOptions = {},
): Promise<DetailedServiceHealth> {
  const timestamp = new Date().toISOString();
  const timeoutMs = options.timeoutMs ?? HEALTH_MONITORING.DEFAULT_PROBE_TIMEOUT_MS;
  const prev = options.previousHealth;

  // Handle explicit simulation in testing or offline mocking
  if (options.simulatedStatus) {
    const isFailure = options.simulatedStatus === 'unhealthy';
    const consecutiveFailures = isFailure ? (prev ? prev.consecutiveFailures + 1 : 1) : 0;
    const latency = options.simulatedLatencyMs ?? def.expectedBaselineLatencyMs;
    const errorRate = isFailure ? 100 : options.simulatedStatus === 'degraded' ? 12 : 0;

    return {
      serviceId: def.id,
      serviceName: def.name,
      category: def.category,
      status: options.simulatedStatus,
      latencyMs: latency,
      errorRatePct: errorRate,
      uptimePct30d: isFailure ? 98.4 : 99.98,
      consecutiveFailures,
      lastCheckedAt: timestamp,
      endpoint: def.endpoint,
      region: def.region,
      details: def.details,
      errorMessage: options.simulatedError,
    };
  }

  // If real HTTP endpoint is present and fetchFn is available
  if (def.endpoint && (def.endpoint.startsWith('http://') || def.endpoint.startsWith('https://'))) {
    const fetchToUse = options.fetchFn ?? globalThis.fetch;

    if (fetchToUse) {
      const startTime = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchToUse(def.endpoint, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timer);
        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
          const failures = (prev?.consecutiveFailures ?? 0) + 1;
          return {
            serviceId: def.id,
            serviceName: def.name,
            category: def.category,
            status: 'unhealthy',
            latencyMs,
            errorRatePct: 100,
            uptimePct30d: 98.5,
            consecutiveFailures: failures,
            lastCheckedAt: timestamp,
            endpoint: def.endpoint,
            region: def.region,
            details: def.details,
            errorMessage: `HTTP ${response.status} ${response.statusText}`,
          };
        }

        // Determine health based on latency thresholds
        let status: HealthStatusLevel = 'healthy';
        if (latencyMs >= HEALTH_MONITORING.LATENCY_CRITICAL_THRESHOLD_MS) {
          status = 'unhealthy';
        } else if (latencyMs >= HEALTH_MONITORING.LATENCY_WARNING_THRESHOLD_MS) {
          status = 'degraded';
        }

        return {
          serviceId: def.id,
          serviceName: def.name,
          category: def.category,
          status,
          latencyMs,
          errorRatePct: status === 'healthy' ? 0.0 : status === 'degraded' ? 3.5 : 25.0,
          uptimePct30d: 99.98,
          consecutiveFailures: 0,
          lastCheckedAt: timestamp,
          endpoint: def.endpoint,
          region: def.region,
          details: def.details,
        };
      } catch (err: unknown) {
        clearTimeout(timer);
        const failures = (prev?.consecutiveFailures ?? 0) + 1;
        const latencyMs = Date.now() - startTime;
        const msg = err instanceof Error ? err.message : String(err);

        return {
          serviceId: def.id,
          serviceName: def.name,
          category: def.category,
          status: 'unhealthy',
          latencyMs: Math.min(latencyMs, timeoutMs),
          errorRatePct: 100,
          uptimePct30d: 97.9,
          consecutiveFailures: failures,
          lastCheckedAt: timestamp,
          endpoint: def.endpoint,
          region: def.region,
          details: def.details,
          errorMessage: msg,
        };
      }
    }
  }

  // Internal / SDK managed simulated check
  return {
    serviceId: def.id,
    serviceName: def.name,
    category: def.category,
    status: 'healthy',
    latencyMs: def.expectedBaselineLatencyMs,
    errorRatePct: 0.0,
    uptimePct30d: 99.99,
    consecutiveFailures: 0,
    lastCheckedAt: timestamp,
    endpoint: def.endpoint,
    region: def.region,
    details: def.details,
  };
}

/**
 * Checks all defined services in parallel.
 */
export async function checkAllMonitoredServices(
  services: ServiceDefinition[] = DEFAULT_MONITORED_SERVICES,
  options: ProbeOptions = {},
): Promise<DetailedServiceHealth[]> {
  const promises = services.map((svc) => probeServiceHeartbeat(svc, options));
  return Promise.all(promises);
}

// ============================================================
// Self-Hosted AI Server Metric Collection
// ============================================================

export function collectAiServerMetrics(
  serverId = 'self_hosted',
  customMetrics?: Partial<AiServerMetrics>,
): AiServerMetrics {
  const timestamp = new Date().toISOString();

  const base: AiServerMetrics = {
    serverId,
    serverName: 'Primary Inference Cluster (vLLM)',
    status: 'healthy',
    cpuUsagePct: 28.5,
    memoryUsedMb: 14336, // ~14GB
    memoryTotalMb: 65536, // 64GB
    gpuUsagePct: 62.4,
    vramUsedMb: 53248, // ~52GB
    vramTotalMb: 81920, // 80GB (A100 80GB)
    queueDepth: 4,
    activeStreams: 6,
    avgLatencyMs: 42,
    temperatureC: 58,
    modelLoaded: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    reportedAt: timestamp,
  };

  if (!customMetrics) {
    return base;
  }

  const merged = { ...base, ...customMetrics, reportedAt: timestamp };

  // Calculate status if not explicitly overridden
  if (!customMetrics.status) {
    if (
      merged.gpuUsagePct >= 95 ||
      merged.vramUsedMb / merged.vramTotalMb >= 0.95 ||
      merged.queueDepth >= 100
    ) {
      merged.status = 'unhealthy';
    } else if (
      merged.gpuUsagePct >= HEALTH_MONITORING.GPU_USAGE_WARNING_THRESHOLD_PCT ||
      (merged.vramUsedMb / merged.vramTotalMb) * 100 >=
        HEALTH_MONITORING.VRAM_USAGE_WARNING_THRESHOLD_PCT ||
      merged.queueDepth >= HEALTH_MONITORING.QUEUE_DEPTH_WARNING_THRESHOLD
    ) {
      merged.status = 'degraded';
    } else {
      merged.status = 'healthy';
    }
  }

  return merged;
}

// ============================================================
// Infrastructure Alert Evaluation Engine
// ============================================================

export function evaluateInfrastructureAlerts(
  services: DetailedServiceHealth[],
  aiServerMetrics: AiServerMetrics[],
  rules: InfrastructureAlertRule[],
): InfrastructureAlertTrigger[] {
  const triggers: InfrastructureAlertTrigger[] = [];
  const now = new Date().toISOString();

  const activeRules = rules.filter((r) => r.enabled);

  for (const rule of activeRules) {
    // 1. Evaluate service-oriented metrics: latency, error rate, consecutive failures
    const targetServices =
      rule.targetServiceId === 'all'
        ? services
        : services.filter((s) => s.serviceId === rule.targetServiceId);

    for (const service of targetServices) {
      if (rule.metric === 'latency_ms') {
        if (service.latencyMs >= rule.threshold) {
          triggers.push({
            id: `trg_${rule.id}_${service.serviceId}_${Date.now()}`,
            ruleId: rule.id,
            ruleName: rule.name,
            targetServiceId: service.serviceId,
            targetServiceName: service.serviceName,
            severity: rule.severity,
            metric: 'latency_ms',
            currentValue: service.latencyMs,
            threshold: rule.threshold,
            message: `${service.serviceName} latency (${service.latencyMs}ms) exceeded threshold of ${rule.threshold}ms`,
            triggeredAt: now,
          });
        }
      } else if (rule.metric === 'error_rate_pct') {
        if (service.errorRatePct >= rule.threshold) {
          triggers.push({
            id: `trg_${rule.id}_${service.serviceId}_${Date.now()}`,
            ruleId: rule.id,
            ruleName: rule.name,
            targetServiceId: service.serviceId,
            targetServiceName: service.serviceName,
            severity: rule.severity,
            metric: 'error_rate_pct',
            currentValue: service.errorRatePct,
            threshold: rule.threshold,
            message: `${service.serviceName} error rate (${service.errorRatePct}%) exceeded threshold of ${rule.threshold}%`,
            triggeredAt: now,
          });
        }
      } else if (rule.metric === 'consecutive_failures') {
        if (service.consecutiveFailures >= rule.threshold) {
          triggers.push({
            id: `trg_${rule.id}_${service.serviceId}_${Date.now()}`,
            ruleId: rule.id,
            ruleName: rule.name,
            targetServiceId: service.serviceId,
            targetServiceName: service.serviceName,
            severity: rule.severity,
            metric: 'consecutive_failures',
            currentValue: service.consecutiveFailures,
            threshold: rule.threshold,
            message: `${service.serviceName} experienced ${service.consecutiveFailures} consecutive probe failures (threshold: ${rule.threshold})`,
            triggeredAt: now,
          });
        }
      }
    }

    // 2. Evaluate AI Server compute metrics: GPU, VRAM, Queue Depth
    const targetServers =
      rule.targetServiceId === 'all' || rule.targetServiceId === 'self_hosted'
        ? aiServerMetrics
        : aiServerMetrics.filter((srv) => srv.serverId === rule.targetServiceId);

    for (const server of targetServers) {
      if (rule.metric === 'gpu_usage_pct') {
        if (server.gpuUsagePct >= rule.threshold) {
          triggers.push({
            id: `trg_${rule.id}_${server.serverId}_${Date.now()}`,
            ruleId: rule.id,
            ruleName: rule.name,
            targetServiceId: server.serverId,
            targetServiceName: server.serverName,
            severity: rule.severity,
            metric: 'gpu_usage_pct',
            currentValue: server.gpuUsagePct,
            threshold: rule.threshold,
            message: `${server.serverName} GPU utilization (${server.gpuUsagePct}%) exceeded threshold of ${rule.threshold}%`,
            triggeredAt: now,
          });
        }
      } else if (rule.metric === 'vram_usage_pct') {
        const vramPct = Number(((server.vramUsedMb / server.vramTotalMb) * 100).toFixed(1));
        if (vramPct >= rule.threshold) {
          triggers.push({
            id: `trg_${rule.id}_${server.serverId}_${Date.now()}`,
            ruleId: rule.id,
            ruleName: rule.name,
            targetServiceId: server.serverId,
            targetServiceName: server.serverName,
            severity: rule.severity,
            metric: 'vram_usage_pct',
            currentValue: vramPct,
            threshold: rule.threshold,
            message: `${server.serverName} VRAM utilization (${vramPct}%) exceeded threshold of ${rule.threshold}%`,
            triggeredAt: now,
          });
        }
      } else if (rule.metric === 'queue_depth') {
        if (server.queueDepth >= rule.threshold) {
          triggers.push({
            id: `trg_${rule.id}_${server.serverId}_${Date.now()}`,
            ruleId: rule.id,
            ruleName: rule.name,
            targetServiceId: server.serverId,
            targetServiceName: server.serverName,
            severity: rule.severity,
            metric: 'queue_depth',
            currentValue: server.queueDepth,
            threshold: rule.threshold,
            message: `${server.serverName} request queue depth (${server.queueDepth}) exceeded threshold of ${rule.threshold}`,
            triggeredAt: now,
          });
        }
      }
    }
  }

  return triggers;
}

// ============================================================
// Platform Health Overview Aggregator
// ============================================================

export function computePlatformOverview(
  services: DetailedServiceHealth[],
  triggers: InfrastructureAlertTrigger[] = [],
): PlatformHealthOverview {
  let healthyCount = 0;
  let degradedCount = 0;
  let unhealthyCount = 0;
  let totalLatency = 0;
  let maxErrorRate = 0;

  for (const svc of services) {
    if (svc.status === 'healthy') healthyCount++;
    else if (svc.status === 'degraded') degradedCount++;
    else unhealthyCount++;

    totalLatency += svc.latencyMs;
    if (svc.errorRatePct > maxErrorRate) {
      maxErrorRate = svc.errorRatePct;
    }
  }

  const total = services.length;
  const avgLatencyMs = total > 0 ? Math.round(totalLatency / total) : 0;

  let overallStatus: HealthStatusLevel = 'healthy';
  if (unhealthyCount > 0 || triggers.some((t) => t.severity === 'critical')) {
    overallStatus = 'unhealthy';
  } else if (degradedCount > 0 || triggers.some((t) => t.severity === 'warning')) {
    overallStatus = 'degraded';
  }

  return {
    overallStatus,
    healthyCount,
    degradedCount,
    unhealthyCount,
    totalServices: total,
    avgLatencyMs,
    maxErrorRatePct: maxErrorRate,
    activeAlertsCount: triggers.length,
    lastCheckedAt: new Date().toISOString(),
  };
}
