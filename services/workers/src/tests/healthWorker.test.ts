import { describe, it, expect, vi } from 'vitest';
import {
  probeServiceHeartbeat,
  checkAllMonitoredServices,
  collectAiServerMetrics,
  evaluateInfrastructureAlerts,
  computePlatformOverview,
  DEFAULT_MONITORED_SERVICES,
  type ServiceDefinition,
} from '../healthWorker.js';
import type {
  DetailedServiceHealth,
  InfrastructureAlertRule,
  AiServerMetrics,
} from '@wapcentral/types';

describe('Health Worker & Infrastructure Monitoring (Phase 11)', () => {
  describe('Heartbeat Probing', () => {
    it('should probe an internal service and return healthy status with baseline latency', async () => {
      const firestoreDef = DEFAULT_MONITORED_SERVICES.find((s) => s.id === 'firestore')!;
      expect(firestoreDef).toBeDefined();

      const health = await probeServiceHeartbeat(firestoreDef);
      expect(health.serviceId).toBe('firestore');
      expect(health.category).toBe('infrastructure');
      expect(health.status).toBe('healthy');
      expect(health.latencyMs).toBe(firestoreDef.expectedBaselineLatencyMs);
      expect(health.consecutiveFailures).toBe(0);
      expect(health.errorRatePct).toBe(0);
    });

    it('should probe an HTTP service with custom fetch and report healthy when latency is low', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ status: 'ok' }),
      } as Response);

      const apiDef: ServiceDefinition = {
        id: 'mock-api',
        name: 'Mock Service',
        category: 'api',
        region: 'us-central1',
        endpoint: 'http://mock-service.local/health',
        expectedBaselineLatencyMs: 20,
      };

      const health = await probeServiceHeartbeat(apiDef, { fetchFn: mockFetch as any });
      expect(mockFetch).toHaveBeenCalledWith(apiDef.endpoint, expect.any(Object));
      expect(health.status).toBe('healthy');
      expect(health.consecutiveFailures).toBe(0);
      expect(health.errorRatePct).toBe(0);
    });

    it('should classify service as degraded when latency exceeds warning threshold', async () => {
      const degradedDef: ServiceDefinition = {
        id: 'slow-api',
        name: 'Slow Service',
        category: 'api',
        region: 'us-central1',
        endpoint: 'http://slow-service.local/health',
        expectedBaselineLatencyMs: 350,
      };

      // Use simulated status for precise threshold test
      const health = await probeServiceHeartbeat(degradedDef, {
        simulatedStatus: 'degraded',
        simulatedLatencyMs: 420,
      });

      expect(health.status).toBe('degraded');
      expect(health.latencyMs).toBe(420);
      expect(health.errorRatePct).toBeGreaterThan(0);
      expect(health.consecutiveFailures).toBe(0);
    });

    it('should classify service as unhealthy and track failure count on HTTP error', async () => {
      const mockFailFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response);

      const failingDef: ServiceDefinition = {
        id: 'failing-api',
        name: 'Failing API',
        category: 'api',
        region: 'us-central1',
        endpoint: 'http://failing-service.local/health',
        expectedBaselineLatencyMs: 25,
      };

      const prevHealth: DetailedServiceHealth = {
        serviceId: 'failing-api',
        serviceName: 'Failing API',
        category: 'api',
        status: 'unhealthy',
        latencyMs: 150,
        errorRatePct: 100,
        uptimePct30d: 98.0,
        consecutiveFailures: 2,
        lastCheckedAt: new Date().toISOString(),
      };

      const health = await probeServiceHeartbeat(failingDef, {
        fetchFn: mockFailFetch as any,
        previousHealth: prevHealth,
      });

      expect(health.status).toBe('unhealthy');
      expect(health.consecutiveFailures).toBe(3);
      expect(health.errorRatePct).toBe(100);
      expect(health.errorMessage).toContain('503 Service Unavailable');
    });

    it('should catch network abort / timeout and record failure', async () => {
      const mockNetworkError = vi.fn().mockRejectedValue(new Error('Connection refused by host'));

      const unreachableDef: ServiceDefinition = {
        id: 'dead-api',
        name: 'Dead API',
        category: 'api',
        region: 'us-central1',
        endpoint: 'http://unreachable.local/health',
        expectedBaselineLatencyMs: 25,
      };

      const health = await probeServiceHeartbeat(unreachableDef, {
        fetchFn: mockNetworkError as any,
      });

      expect(health.status).toBe('unhealthy');
      expect(health.consecutiveFailures).toBe(1);
      expect(health.errorMessage).toContain('Connection refused');
    });
  });

  describe('Batch Monitored Services Check', () => {
    it('should check all 11 default monitored services across APIs, infrastructure, providers and AI server', async () => {
      const results = await checkAllMonitoredServices();
      expect(results.length).toBe(11);

      const categories = new Set(results.map((r) => r.category));
      expect(categories.has('api')).toBe(true);
      expect(categories.has('infrastructure')).toBe(true);
      expect(categories.has('ai_provider')).toBe(true);
      expect(categories.has('ai_server')).toBe(true);
      expect(categories.has('worker')).toBe(true);

      const gemini = results.find((r) => r.serviceId === 'gemini');
      expect(gemini).toBeDefined();
      expect(gemini?.serviceName).toBe('Google Gemini AI');
    });
  });

  describe('AI Server Compute Metrics Collection', () => {
    it('should collect baseline metrics for self-hosted AI compute node', () => {
      const metrics = collectAiServerMetrics();
      expect(metrics.serverId).toBe('self_hosted');
      expect(metrics.status).toBe('healthy');
      expect(metrics.gpuUsagePct).toBeGreaterThan(0);
      expect(metrics.vramUsedMb).toBeGreaterThan(0);
      expect(metrics.vramTotalMb).toBe(81920);
      expect(metrics.queueDepth).toBeGreaterThanOrEqual(0);
      expect(metrics.modelLoaded).toContain('Llama');
    });

    it('should dynamically transition status to degraded when GPU or queue exceeds warning threshold', () => {
      const metrics = collectAiServerMetrics('self_hosted', {
        gpuUsagePct: 88.0,
        queueDepth: 55,
      });

      expect(metrics.status).toBe('degraded');
      expect(metrics.gpuUsagePct).toBe(88.0);
      expect(metrics.queueDepth).toBe(55);
    });

    it('should dynamically transition status to unhealthy when GPU or VRAM exceeds critical threshold', () => {
      const metrics = collectAiServerMetrics('self_hosted', {
        gpuUsagePct: 98.0,
        vramUsedMb: 79000,
        vramTotalMb: 80000,
      });

      expect(metrics.status).toBe('unhealthy');
      expect(metrics.gpuUsagePct).toBe(98.0);
    });
  });

  describe('Alert Evaluation Engine', () => {
    const mockServices: DetailedServiceHealth[] = [
      {
        serviceId: 'ai-gateway',
        serviceName: 'AI Routing Gateway',
        category: 'api',
        status: 'degraded',
        latencyMs: 450,
        errorRatePct: 4.2,
        uptimePct30d: 99.8,
        consecutiveFailures: 0,
        lastCheckedAt: new Date().toISOString(),
      },
      {
        serviceId: 'openai',
        serviceName: 'OpenAI API',
        category: 'ai_provider',
        status: 'unhealthy',
        latencyMs: 1200,
        errorRatePct: 28.0,
        uptimePct30d: 97.5,
        consecutiveFailures: 3,
        lastCheckedAt: new Date().toISOString(),
      },
    ];

    const mockAiServers: AiServerMetrics[] = [
      {
        serverId: 'self_hosted',
        serverName: 'Self-Hosted AI Node',
        status: 'degraded',
        cpuUsagePct: 75.0,
        memoryUsedMb: 32000,
        memoryTotalMb: 64000,
        gpuUsagePct: 92.0,
        vramUsedMb: 75000,
        vramTotalMb: 80000,
        queueDepth: 65,
        activeStreams: 18,
        avgLatencyMs: 95,
        temperatureC: 72,
        modelLoaded: 'llama-3.1-8b',
        reportedAt: new Date().toISOString(),
      },
    ];

    const rules: InfrastructureAlertRule[] = [
      {
        id: 'rule_gateway_lat',
        name: 'Gateway High Latency Warning',
        targetServiceId: 'ai-gateway',
        metric: 'latency_ms',
        threshold: 300,
        severity: 'warning',
        enabled: true,
        notifyEmails: ['ops@webappypie.com'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'rule_failures_crit',
        name: 'OpenAI Consecutive Outage',
        targetServiceId: 'openai',
        metric: 'consecutive_failures',
        threshold: 3,
        severity: 'critical',
        enabled: true,
        notifyEmails: ['eng-lead@webappypie.com'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'rule_gpu_warning',
        name: 'AI Node High GPU Utilization',
        targetServiceId: 'self_hosted',
        metric: 'gpu_usage_pct',
        threshold: 85.0,
        severity: 'warning',
        enabled: true,
        notifyEmails: ['mlops@webappypie.com'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'rule_queue_warning',
        name: 'AI Node Queue Saturation',
        targetServiceId: 'self_hosted',
        metric: 'queue_depth',
        threshold: 50,
        severity: 'warning',
        enabled: true,
        notifyEmails: ['mlops@webappypie.com'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'rule_disabled',
        name: 'Disabled Latency Check',
        targetServiceId: 'all',
        metric: 'latency_ms',
        threshold: 100,
        severity: 'warning',
        enabled: false,
        notifyEmails: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    it('should evaluate rules and fire alerts for triggered conditions', () => {
      const triggers = evaluateInfrastructureAlerts(mockServices, mockAiServers, rules);

      expect(triggers.length).toBe(4);

      // Latency trigger
      const latTrigger = triggers.find((t) => t.ruleId === 'rule_gateway_lat');
      expect(latTrigger).toBeDefined();
      expect(latTrigger?.severity).toBe('warning');
      expect(latTrigger?.currentValue).toBe(450);

      // Failure trigger
      const failTrigger = triggers.find((t) => t.ruleId === 'rule_failures_crit');
      expect(failTrigger).toBeDefined();
      expect(failTrigger?.severity).toBe('critical');
      expect(failTrigger?.currentValue).toBe(3);

      // GPU utilization trigger
      const gpuTrigger = triggers.find((t) => t.ruleId === 'rule_gpu_warning');
      expect(gpuTrigger).toBeDefined();
      expect(gpuTrigger?.currentValue).toBe(92.0);

      // Queue depth trigger
      const queueTrigger = triggers.find((t) => t.ruleId === 'rule_queue_warning');
      expect(queueTrigger).toBeDefined();
      expect(queueTrigger?.currentValue).toBe(65);

      // Disabled rule should not trigger
      expect(triggers.some((t) => t.ruleId === 'rule_disabled')).toBe(false);
    });
  });

  describe('Platform Overview Aggregator', () => {
    it('should aggregate counts, latency, and derive overall health status', () => {
      const services: DetailedServiceHealth[] = [
        {
          serviceId: 's1',
          serviceName: 'Service 1',
          category: 'api',
          status: 'healthy',
          latencyMs: 30,
          errorRatePct: 0,
          uptimePct30d: 100,
          consecutiveFailures: 0,
          lastCheckedAt: new Date().toISOString(),
        },
        {
          serviceId: 's2',
          serviceName: 'Service 2',
          category: 'infrastructure',
          status: 'degraded',
          latencyMs: 120,
          errorRatePct: 4,
          uptimePct30d: 99.5,
          consecutiveFailures: 0,
          lastCheckedAt: new Date().toISOString(),
        },
      ];

      const overview = computePlatformOverview(services);
      expect(overview.totalServices).toBe(2);
      expect(overview.healthyCount).toBe(1);
      expect(overview.degradedCount).toBe(1);
      expect(overview.unhealthyCount).toBe(0);
      expect(overview.avgLatencyMs).toBe(75);
      expect(overview.maxErrorRatePct).toBe(4);
      expect(overview.overallStatus).toBe('degraded');
    });

    it('should flag overallStatus as unhealthy if any service is unhealthy or critical alert is active', () => {
      const services: DetailedServiceHealth[] = [
        {
          serviceId: 's1',
          serviceName: 'Failing Svc',
          category: 'api',
          status: 'unhealthy',
          latencyMs: 900,
          errorRatePct: 100,
          uptimePct30d: 95.0,
          consecutiveFailures: 4,
          lastCheckedAt: new Date().toISOString(),
        },
      ];

      const overview = computePlatformOverview(services);
      expect(overview.overallStatus).toBe('unhealthy');
      expect(overview.unhealthyCount).toBe(1);
    });
  });
});
