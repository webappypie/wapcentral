import { Router } from 'express';
import type { Response } from 'express';
import { COLLECTIONS } from '@wapcentral/config';
import type {
  CostAlertRule,
  DataRetentionPolicy,
  UsageEvent,
  Campaign,
  PromotionEvent,
} from '@wapcentral/types';
import {
  CreateCostAlertRuleSchema,
  DataRetentionPolicySchema,
  AnalyticsDateRangeQuerySchema,
  AnalyticsExportQuerySchema,
  AnalyticsAggregationTriggerSchema,
  BatchAdTelemetryEventSchema,
  AdTelemetryEventInputSchema,
} from '@wapcentral/validation';
import {
  aggregateUsageBreakdowns,
  evaluateCostAlerts,
  aggregateCampaignPerformance,
} from '@wapcentral/workers';
import { requireRole } from '../middleware/rbac.js';
import { logAdminAction } from '../services/auditService.js';
import { getFirestoreDb } from '../services/firestore.js';
import { AnalyticsQueryService } from '../services/analytics/analyticsQueryService.js';
import { AnalyticsAggregationService } from '../services/analytics/analyticsAggregationService.js';
import { AnalyticsEventService } from '../services/analytics/analyticsEventService.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export const analyticsRouter: Router = Router();

// ============================================================
// Helpers
// ============================================================

function mapDocToUsageEvent(id: string, data: Record<string, any> | undefined): UsageEvent {
  const d = data || {};
  return {
    id: d['id'] || id,
    appId: d['appId'] || 'unknown',
    providerId: d['providerId'] || 'unknown',
    modelId: d['modelId'] || 'unknown',
    feature: d['feature'] || 'unknown',
    requestId: d['requestId'] || id,
    inputTokens: d['inputTokens'] !== undefined ? Number(d['inputTokens']) : undefined,
    outputTokens: d['outputTokens'] !== undefined ? Number(d['outputTokens']) : undefined,
    costEstimateUsd: d['costEstimateUsd'] !== undefined ? Number(d['costEstimateUsd']) : undefined,
    latencyMs: Number(d['latencyMs'] || 0),
    success: d['success'] !== undefined ? Boolean(d['success']) : true,
    error: d['error'] || undefined,
    timestamp: d['timestamp'] || (d['createdAt']?.toDate?.()?.toISOString() ?? new Date().toISOString()),
  };
}

function mapDocToAlertRule(id: string, data: Record<string, any> | undefined): CostAlertRule {
  const d = data || {};
  return {
    id: d['id'] || id,
    name: d['name'] || 'Unnamed Rule',
    ...(d['appId'] ? { appId: d['appId'] } : {}),
    metric: d['metric'] || 'daily_cost_usd',
    threshold: Number(d['threshold'] || 0),
    enabled: d['enabled'] !== undefined ? Boolean(d['enabled']) : true,
    notifyEmails: Array.isArray(d['notifyEmails']) ? d['notifyEmails'] : [],
    createdAt: d['createdAt']?.toDate?.()?.toISOString() ?? d['createdAt'] ?? new Date().toISOString(),
    updatedAt: d['updatedAt']?.toDate?.()?.toISOString() ?? d['updatedAt'] ?? new Date().toISOString(),
  };
}

// ============================================================
// 1. AI Usage & Telemetry Analytics
// ============================================================

// GET /v1/analytics/usage - Aggregated usage metrics from Firestore telemetry
analyticsRouter.get(
  '/usage',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const days = req.query['days'] !== undefined ? Number(req.query['days']) : 30;
      const appId = typeof req.query['appId'] === 'string' && req.query['appId'] !== 'all' ? req.query['appId'] : undefined;
      const providerId = typeof req.query['providerId'] === 'string' && req.query['providerId'] !== 'all' ? req.query['providerId'] : undefined;
      const modelId = typeof req.query['modelId'] === 'string' && req.query['modelId'] !== 'all' ? req.query['modelId'] : undefined;

      const db = getFirestoreDb();
      const snapshot = await db.collection(COLLECTIONS.USAGE_EVENTS).get();
      const events: UsageEvent[] = snapshot.docs.map((docSnap) =>
        mapDocToUsageEvent(docSnap.id, docSnap.data()),
      );

      const summary = aggregateUsageBreakdowns(
        events,
        days > 0 ? days : undefined,
        new Date(),
        { appId, providerId, modelId },
      );

      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to aggregate usage analytics';
      res.status(500).json({
        success: false,
        error: { code: 'ANALYTICS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// ============================================================
// 2. Cost Alerts & Threshold Rules
// ============================================================

// GET /v1/analytics/alerts - List cost alert rules and evaluated triggers
analyticsRouter.get(
  '/alerts',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getFirestoreDb();
      const [rulesSnap, eventsSnap] = await Promise.all([
        db.collection(COLLECTIONS.COST_ALERTS).get(),
        db.collection(COLLECTIONS.USAGE_EVENTS).get(),
      ]);

      const rules: CostAlertRule[] = rulesSnap.docs.map((docSnap) =>
        mapDocToAlertRule(docSnap.id, docSnap.data()),
      );

      const events: UsageEvent[] = eventsSnap.docs.map((docSnap) =>
        mapDocToUsageEvent(docSnap.id, docSnap.data()),
      );

      const triggers = evaluateCostAlerts(events, rules);

      res.json({
        success: true,
        data: {
          rules,
          triggers,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load cost alert rules';
      res.status(500).json({
        success: false,
        error: { code: 'ALERTS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// POST /v1/analytics/alerts - Create a cost alert rule
analyticsRouter.post(
  '/alerts',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = CreateCostAlertRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid cost alert rule payload',
            details: parsed.error.issues,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const db = getFirestoreDb();
      const ruleId = typeof req.body.id === 'string' && req.body.id.trim()
        ? req.body.id.trim()
        : `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();

      const newRule: CostAlertRule = {
        id: ruleId,
        name: parsed.data.name,
        ...(parsed.data.appId ? { appId: parsed.data.appId } : {}),
        metric: parsed.data.metric,
        threshold: parsed.data.threshold,
        enabled: parsed.data.enabled,
        notifyEmails: parsed.data.notifyEmails || [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await db.collection(COLLECTIONS.COST_ALERTS).doc(ruleId).set(newRule);

      await logAdminAction({
        action: 'flag.update',
        actorUid: req.user?.uid || 'system',
        actorEmail: req.user?.email || 'admin@webappypie.com',
        resourceType: 'alert_rule',
        resourceId: ruleId,
        changes: { rule: { before: null, after: newRule } },
      });

      res.status(201).json({
        success: true,
        data: newRule,
        timestamp: nowIso,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create cost alert rule';
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// PATCH /v1/analytics/alerts/:id - Toggle or update cost alert rule
analyticsRouter.patch(
  '/alerts/:id',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ruleId = String(req.params['id'] || '');
      const db = getFirestoreDb();
      const docRef = db.collection(COLLECTIONS.COST_ALERTS).doc(ruleId);
      const snap = await docRef.get();

      if (!snap.exists) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Alert rule '${ruleId}' not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const existing = mapDocToAlertRule(snap.id, snap.data());
      const nowIso = new Date().toISOString();
      const updates: Partial<CostAlertRule> = {
        updatedAt: nowIso,
      };

      if (typeof req.body.enabled === 'boolean') updates.enabled = req.body.enabled;
      if (typeof req.body.name === 'string') updates.name = req.body.name;
      if (typeof req.body.threshold === 'number') updates.threshold = req.body.threshold;
      if (Array.isArray(req.body.notifyEmails)) updates.notifyEmails = req.body.notifyEmails;

      const updated = { ...existing, ...updates };
      await docRef.set(updated, { merge: true });

      await logAdminAction({
        action: 'flag.update',
        actorUid: req.user?.uid || 'system',
        actorEmail: req.user?.email || 'admin@webappypie.com',
        resourceType: 'alert_rule',
        resourceId: ruleId,
        changes: { rule: { before: existing, after: updated } },
      });

      res.json({
        success: true,
        data: updated,
        timestamp: nowIso,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update alert rule';
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// DELETE /v1/analytics/alerts/:id - Delete cost alert rule
analyticsRouter.delete(
  '/alerts/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ruleId = String(req.params['id'] || '');
      const db = getFirestoreDb();
      const docRef = db.collection(COLLECTIONS.COST_ALERTS).doc(ruleId);
      const snap = await docRef.get();

      if (!snap.exists) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Alert rule '${ruleId}' not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const existing = snap.data();
      await docRef.delete();

      await logAdminAction({
        action: 'flag.update',
        actorUid: req.user?.uid || 'system',
        actorEmail: req.user?.email || 'admin@webappypie.com',
        resourceType: 'alert_rule',
        resourceId: ruleId,
        changes: { rule: { before: existing, after: null } },
      });

      res.json({
        success: true,
        message: `Alert rule '${ruleId}' deleted successfully.`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete alert rule';
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// ============================================================
// 3. Data Retention Policy & Maintenance Pruning
// ============================================================

const DEFAULT_RETENTION_POLICY: DataRetentionPolicy = {
  usageEventsTtlDays: 90,
  promotionEventsTtlDays: 90,
  auditLogsTtlDays: 365,
  lastPrunedAt: undefined,
  prunedCount: 0,
};

// GET /v1/analytics/retention - Get data retention policy
analyticsRouter.get(
  '/retention',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getFirestoreDb();
      const snap = await db.collection(COLLECTIONS.DATA_RETENTION).doc('global').get();
      if (!snap.exists) {
        res.json({
          success: true,
          data: DEFAULT_RETENTION_POLICY,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const data = snap.data() || {};
      res.json({
        success: true,
        data: {
          usageEventsTtlDays: Number(data['usageEventsTtlDays'] || 90),
          promotionEventsTtlDays: Number(data['promotionEventsTtlDays'] || 90),
          auditLogsTtlDays: Number(data['auditLogsTtlDays'] || 365),
          lastPrunedAt: data['lastPrunedAt'] || undefined,
          prunedCount: Number(data['prunedCount'] || 0),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to read retention policy';
      res.status(500).json({
        success: false,
        error: { code: 'RETENTION_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// PUT /v1/analytics/retention - Update data retention policy
analyticsRouter.put(
  '/retention',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = DataRetentionPolicySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid retention policy payload',
            details: parsed.error.issues,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const db = getFirestoreDb();
      const docRef = db.collection(COLLECTIONS.DATA_RETENTION).doc('global');
      const snap = await docRef.get();
      const current = snap.exists ? snap.data() : DEFAULT_RETENTION_POLICY;

      const updated: DataRetentionPolicy = {
        usageEventsTtlDays: parsed.data.usageEventsTtlDays,
        promotionEventsTtlDays: parsed.data.promotionEventsTtlDays,
        auditLogsTtlDays: parsed.data.auditLogsTtlDays,
        lastPrunedAt: current?.lastPrunedAt,
        prunedCount: current?.prunedCount || 0,
      };

      await docRef.set(updated, { merge: true });

      await logAdminAction({
        action: 'app.update',
        actorUid: req.user?.uid || 'system',
        actorEmail: req.user?.email || 'admin@webappypie.com',
        resourceType: 'retention_policy',
        resourceId: 'global',
        changes: { policy: { before: current, after: updated } },
      });

      res.json({
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update retention policy';
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// POST /v1/analytics/retention/prune - Trigger retention cleanup
analyticsRouter.post(
  '/retention/prune',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getFirestoreDb();
      const docRef = db.collection(COLLECTIONS.DATA_RETENTION).doc('global');
      const snap = await docRef.get();
      const policyData = snap.exists ? snap.data() || {} : DEFAULT_RETENTION_POLICY;
      const ttlDays = Number(policyData['usageEventsTtlDays'] || 90);

      const cutoffTime = Date.now() - ttlDays * 24 * 60 * 60 * 1000;
      const eventsSnap = await db.collection(COLLECTIONS.USAGE_EVENTS).get();

      let prunedCount = 0;
      for (const d of eventsSnap.docs) {
        const evData = d.data();
        const ts = evData?.['timestamp'];
        if (ts && new Date(ts).getTime() < cutoffTime) {
          await db.collection(COLLECTIONS.USAGE_EVENTS).doc(d.id).delete();
          prunedCount++;
        }
      }

      const nowIso = new Date().toISOString();
      const totalPruned = Number(policyData['prunedCount'] || 0) + prunedCount;

      await docRef.set(
        {
          lastPrunedAt: nowIso,
          prunedCount: totalPruned,
        },
        { merge: true },
      );

      await logAdminAction({
        action: 'app.update',
        actorUid: req.user?.uid || 'system',
        actorEmail: req.user?.email || 'admin@webappypie.com',
        resourceType: 'retention_cleanup',
        resourceId: 'global',
        metadata: { prunedCount, totalPruned, ttlDays },
      });

      res.json({
        success: true,
        data: {
          prunedCount,
          timestamp: nowIso,
        },
        timestamp: nowIso,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to execute retention pruning';
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// ============================================================
// 4. Self-Promotion Campaign Analytics
// ============================================================

// GET /v1/analytics/campaigns - Real promotion delivery and CTR performance
analyticsRouter.get(
  '/campaigns',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getFirestoreDb();
      const [campaignsSnap, eventsSnap] = await Promise.all([
        db.collection(COLLECTIONS.CAMPAIGNS).get(),
        db.collection(COLLECTIONS.PROMOTION_EVENTS).get(),
      ]);

      const campaigns: Campaign[] = campaignsSnap.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          name: data['name'] || 'Unnamed Campaign',
          promotedAppId: data['promotedAppId'] || '',
          targetAppIds: Array.isArray(data['targetAppIds']) ? data['targetAppIds'] : [],
          title: data['title'] || '',
          description: data['description'] || '',
          ctaText: data['ctaText'] || 'Install',
          storeUrl: data['storeUrl'] || '',
          layoutVariant: data['layoutVariant'] || 'banner',
          priority: Number(data['priority'] || 50),
          enabled: Boolean(data['enabled'] ?? true),
          status: data['status'] || 'draft',
          analytics: data['analytics'] || { impressions: 0, clicks: 0, ctr: 0 },
          createdAt: data['createdAt'] || new Date().toISOString(),
          updatedAt: data['updatedAt'] || new Date().toISOString(),
        };
      });

      const events: PromotionEvent[] = eventsSnap.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          eventType: data['eventType'] || 'impression',
          campaignId: data['campaignId'] || '',
          appId: data['appId'] || '',
          timestamp: data['timestamp'] || new Date().toISOString(),
        };
      });

      const performance = aggregateCampaignPerformance(campaigns, events);

      res.json({
        success: true,
        data: performance,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to aggregate campaign performance';
      res.status(500).json({
        success: false,
        error: { code: 'CAMPAIGN_ANALYTICS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// ============================================================
// 5. Analytics & Revenue Intelligence Endpoints (Step 4)
// ============================================================

// GET /v1/analytics/overview
analyticsRouter.get(
  '/overview',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = AnalyticsDateRangeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: parsed.error.format() },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const overview = await AnalyticsQueryService.getOverview(parsed.data);
      res.json({
        success: true,
        data: overview,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve analytics overview';
      res.status(500).json({
        success: false,
        error: { code: 'ANALYTICS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /v1/analytics/apps
analyticsRouter.get(
  '/apps',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = AnalyticsDateRangeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: parsed.error.format() },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const apps = await AnalyticsQueryService.getApps(parsed.data);
      res.json({
        success: true,
        data: apps,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve app analytics';
      res.status(500).json({
        success: false,
        error: { code: 'ANALYTICS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /v1/analytics/networks
analyticsRouter.get(
  '/networks',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = AnalyticsDateRangeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: parsed.error.format() },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const networks = await AnalyticsQueryService.getNetworks(parsed.data);
      res.json({
        success: true,
        data: networks,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve network analytics';
      res.status(500).json({
        success: false,
        error: { code: 'ANALYTICS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /v1/analytics/formats
analyticsRouter.get(
  '/formats',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = AnalyticsDateRangeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: parsed.error.format() },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const formats = await AnalyticsQueryService.getFormats(parsed.data);
      res.json({
        success: true,
        data: formats,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve format analytics';
      res.status(500).json({
        success: false,
        error: { code: 'ANALYTICS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /v1/analytics/placements
analyticsRouter.get(
  '/placements',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = AnalyticsDateRangeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: parsed.error.format() },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const placements = await AnalyticsQueryService.getPlacements(parsed.data);
      res.json({
        success: true,
        data: placements,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve placement analytics';
      res.status(500).json({
        success: false,
        error: { code: 'ANALYTICS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /v1/analytics/revenue
analyticsRouter.get(
  '/revenue',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = AnalyticsDateRangeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: parsed.error.format() },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const revenueData = await AnalyticsQueryService.getRevenueIntelligence(parsed.data);
      res.json({
        success: true,
        data: revenueData,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve revenue intelligence';
      res.status(500).json({
        success: false,
        error: { code: 'ANALYTICS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /v1/analytics/custom-ads
analyticsRouter.get(
  '/custom-ads',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = AnalyticsDateRangeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: parsed.error.format() },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const customAds = await AnalyticsQueryService.getCustomAds(parsed.data);
      res.json({
        success: true,
        data: customAds,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve custom ads performance';
      res.status(500).json({
        success: false,
        error: { code: 'ANALYTICS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /v1/analytics/notifications
analyticsRouter.get(
  '/notifications',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = AnalyticsDateRangeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: parsed.error.format() },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const notifications = await AnalyticsQueryService.getNotifications(parsed.data);
      res.json({
        success: true,
        data: notifications,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve notification analytics';
      res.status(500).json({
        success: false,
        error: { code: 'ANALYTICS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /v1/analytics/timeseries
analyticsRouter.get(
  '/timeseries',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = AnalyticsDateRangeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: parsed.error.format() },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const timeSeries = await AnalyticsQueryService.getTimeSeries(parsed.data);
      res.json({
        success: true,
        data: timeSeries,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve time series analytics';
      res.status(500).json({
        success: false,
        error: { code: 'ANALYTICS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /v1/analytics/export
analyticsRouter.get(
  '/export',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = AnalyticsExportQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid export query parameters', details: parsed.error.format() },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const exportResult = await AnalyticsQueryService.getExport(parsed.data);
      if (parsed.data.type === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
        res.send(exportResult.data);
      } else {
        res.json({
          success: true,
          data: exportResult.data,
          filename: exportResult.filename,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export analytics data';
      res.status(500).json({
        success: false,
        error: { code: 'ANALYTICS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /v1/analytics/cost-intelligence
analyticsRouter.get(
  '/cost-intelligence',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const costData = await AnalyticsQueryService.getCostIntelligence();
      res.json({
        success: true,
        data: costData,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve cost intelligence';
      res.status(500).json({
        success: false,
        error: { code: 'ANALYTICS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// POST /v1/analytics/aggregate - Trigger daily rollup
analyticsRouter.post(
  '/aggregate',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = AnalyticsAggregationTriggerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid aggregation payload', details: parsed.error.format() },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await AnalyticsAggregationService.runDailyRollup(parsed.data.date);

      await logAdminAction({
        action: 'app.update',
        actorUid: req.user?.uid || 'system',
        actorEmail: req.user?.email || 'admin@webappypie.com',
        resourceType: 'analytics_rollup',
        resourceId: result.date,
        changes: {
          rollup: {
            before: null,
            after: { date: result.date, count: result.aggregatesCount },
          },
        },
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to execute daily aggregation rollup';
      res.status(500).json({
        success: false,
        error: { code: 'ANALYTICS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// POST /v1/analytics/events - Direct/Admin event ingestion
analyticsRouter.post(
  '/events',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const appId = String(req.body?.appId || req.query?.['appId'] || 'unknown');
      let eventsToProcess: any[] = [];

      if (Array.isArray(req.body?.events)) {
        const parsedBatch = BatchAdTelemetryEventSchema.safeParse(req.body);
        if (!parsedBatch.success) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid batch events payload', details: parsedBatch.error.format() },
            timestamp: new Date().toISOString(),
          });
          return;
        }
        eventsToProcess = parsedBatch.data.events;
      } else {
        const parsedSingle = AdTelemetryEventInputSchema.safeParse(req.body);
        if (!parsedSingle.success) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid single event payload', details: parsedSingle.error.format() },
            timestamp: new Date().toISOString(),
          });
          return;
        }
        eventsToProcess = [parsedSingle.data];
      }

      const result = await AnalyticsEventService.recordEvents(appId, eventsToProcess);
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to ingest analytics events';
      res.status(500).json({
        success: false,
        error: { code: 'ANALYTICS_ERROR', message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  },
);
