import { Router } from 'express';
import type { Response } from 'express';
import {
  CreateAdNetworkSchema,
  UpdateAdNetworkSchema,
  UpdateAdAppConfigSchema,
  CreateAdUnitDocSchema,
  UpdateAdUnitDocSchema,
  CreateAdPlacementDocSchema,
  UpdateAdPlacementDocSchema,
  AdRotationPolicySchema,
  UpdateAdFrequencyPolicySchema,
  UpdateAdSafetyPolicySchema,
  CreateCustomAdCampaignSchema,
  UpdateCustomAdCampaignSchema,
  UpdateAdKillSwitchesSchema,
} from '@wapcentral/validation';
import type { AuthenticatedRequest } from '../types/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { getAuditLogs } from '../services/auditService.js';
import {
  getAdsOverviewMetrics,
  getAdNetworks,
  getAdNetwork,
  createAdNetwork,
  updateAdNetwork,
  deleteAdNetwork,
  getAdAppConfigs,
  getAdAppConfig,
  upsertAdAppConfig,
  getAdUnits,
  getAdUnit,
  createAdUnit,
  updateAdUnit,
  deleteAdUnit,
  getAdPlacements,
  getAdPlacement,
  createAdPlacement,
  updateAdPlacement,
  deleteAdPlacement,
  getAdRotationPolicies,
  getAdRotationPolicy,
  upsertAdRotationPolicy,
  getAdFrequencyPolicies,
  getAdFrequencyPolicy,
  upsertAdFrequencyPolicy,
  getAdSafetyPolicies,
  getAdSafetyPolicy,
  upsertAdSafetyPolicy,
  getCustomAdCampaigns,
  getCustomAdCampaign,
  createCustomAdCampaign,
  updateCustomAdCampaign,
  deleteCustomAdCampaign,
  getAdKillSwitches,
  updateAdKillSwitches,
  resolveEffectiveAdConfig,
  getOfficialAdTestCatalog,
} from '../services/adConfigService.js';

export const adsRouter: Router = Router();

// ============================================================
// 1. Overview & Metrics
// ============================================================
adsRouter.get(
  '/overview',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const metrics = await getAdsOverviewMetrics();
      const allLogs = getAuditLogs(50);
      const adsLogs = allLogs.filter(
        (l) => l.action.startsWith('ads.') || l.metadata?.['module'] === 'ads',
      );
      metrics.recentAuditLogs = adsLogs;

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'OVERVIEW_ERROR', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// ============================================================
// 2. Ad Networks Endpoints
// ============================================================
adsRouter.get(
  '/networks',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    const networks = await getAdNetworks();
    res.json({ success: true, data: networks, timestamp: new Date().toISOString() });
  },
);

adsRouter.get(
  '/networks/:id',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    const network = await getAdNetwork(id);
    if (!network) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Ad Network '${id}' not found.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({ success: true, data: network, timestamp: new Date().toISOString() });
  },
);

adsRouter.post(
  '/networks',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = CreateAdNetworkSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid Ad Network payload',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const created = await createAdNetwork(parsed.data, {
      uid: req.user?.uid || 'system',
      email: req.user?.email || 'admin@webappypie.com',
    });
    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() });
  },
);

adsRouter.put(
  '/networks/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    const parsed = UpdateAdNetworkSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid Ad Network update payload',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const updated = await updateAdNetwork(id, parsed.data, {
        uid: req.user?.uid || 'system',
        email: req.user?.email || 'admin@webappypie.com',
      });
      res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

adsRouter.delete(
  '/networks/:id',
  requireRole('super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    try {
      await deleteAdNetwork(id, {
        uid: req.user?.uid || 'system',
        email: req.user?.email || 'super_admin@webappypie.com',
      });
      res.json({
        success: true,
        message: `Network '${id}' deleted successfully.`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// ============================================================
// 3. App-wise Ad Configuration Endpoints
// ============================================================
adsRouter.get(
  '/apps',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    const configs = await getAdAppConfigs();
    res.json({ success: true, data: configs, timestamp: new Date().toISOString() });
  },
);

adsRouter.get(
  '/apps/:appId',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const appId = String(req.params['appId'] || '');
    const config = await getAdAppConfig(appId);
    if (!config) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `App config '${appId}' not found.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({ success: true, data: config, timestamp: new Date().toISOString() });
  },
);

adsRouter.put(
  '/apps/:appId',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const appId = String(req.params['appId'] || '');
    const parsed = UpdateAdAppConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid App Ad config update payload',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const saved = await upsertAdAppConfig(appId, parsed.data, {
      uid: req.user?.uid || 'system',
      email: req.user?.email || 'admin@webappypie.com',
    });
    res.json({ success: true, data: saved, timestamp: new Date().toISOString() });
  },
);

// ============================================================
// 4. Ad Units Endpoints
// ============================================================
adsRouter.get(
  '/units',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const appId = req.query['appId'] as string | undefined;
    const units = await getAdUnits(appId);
    res.json({ success: true, data: units, timestamp: new Date().toISOString() });
  },
);

adsRouter.get(
  '/units/:id',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    const unit = await getAdUnit(id);
    if (!unit) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Ad Unit '${id}' not found.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({ success: true, data: unit, timestamp: new Date().toISOString() });
  },
);

adsRouter.post(
  '/units',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = CreateAdUnitDocSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid Ad Unit payload',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const created = await createAdUnit(parsed.data, {
      uid: req.user?.uid || 'system',
      email: req.user?.email || 'admin@webappypie.com',
    });
    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() });
  },
);

adsRouter.put(
  '/units/:id',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    const parsed = UpdateAdUnitDocSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid Ad Unit update payload',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const updated = await updateAdUnit(id, parsed.data, {
        uid: req.user?.uid || 'system',
        email: req.user?.email || 'admin@webappypie.com',
      });
      res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

adsRouter.delete(
  '/units/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    try {
      await deleteAdUnit(id, {
        uid: req.user?.uid || 'system',
        email: req.user?.email || 'admin@webappypie.com',
      });
      res.json({
        success: true,
        message: `Ad Unit '${id}' deleted successfully.`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// ============================================================
// 5. Ad Placements Endpoints
// ============================================================
adsRouter.get(
  '/placements',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const appId = req.query['appId'] as string | undefined;
    const placements = await getAdPlacements(appId);
    res.json({ success: true, data: placements, timestamp: new Date().toISOString() });
  },
);

adsRouter.post(
  '/placements',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = CreateAdPlacementDocSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid Placement payload',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const created = await createAdPlacement(parsed.data, {
      uid: req.user?.uid || 'system',
      email: req.user?.email || 'admin@webappypie.com',
    });
    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() });
  },
);

adsRouter.put(
  '/placements/:id',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    const parsed = UpdateAdPlacementDocSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid Placement update payload',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const updated = await updateAdPlacement(id, parsed.data, {
        uid: req.user?.uid || 'system',
        email: req.user?.email || 'admin@webappypie.com',
      });
      res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

adsRouter.delete(
  '/placements/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    try {
      await deleteAdPlacement(id, {
        uid: req.user?.uid || 'system',
        email: req.user?.email || 'admin@webappypie.com',
      });
      res.json({
        success: true,
        message: `Placement '${id}' deleted successfully.`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// ============================================================
// 6. Rotation & Mediation Policies
// ============================================================
adsRouter.get(
  '/rotation',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    const policies = await getAdRotationPolicies();
    res.json({ success: true, data: policies, timestamp: new Date().toISOString() });
  },
);

adsRouter.get(
  '/rotation/:appId',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const appId = String(req.params['appId'] || '');
    const format = (req.query['format'] as any) || 'banner';
    const policy = await getAdRotationPolicy(appId, format);
    res.json({ success: true, data: policy, timestamp: new Date().toISOString() });
  },
);

adsRouter.put(
  '/rotation/:appId',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = AdRotationPolicySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid Rotation Policy payload (e.g. bannerRefreshIntervalSeconds >= 30)',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const saved = await upsertAdRotationPolicy(parsed.data, {
      uid: req.user?.uid || 'system',
      email: req.user?.email || 'admin@webappypie.com',
    });
    res.json({ success: true, data: saved, timestamp: new Date().toISOString() });
  },
);

// ============================================================
// 7. Frequency Policies
// ============================================================
adsRouter.get(
  '/frequency',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    const policies = await getAdFrequencyPolicies();
    res.json({ success: true, data: policies, timestamp: new Date().toISOString() });
  },
);

adsRouter.get(
  '/frequency/:appId',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const appId = String(req.params['appId'] || '');
    const policy = await getAdFrequencyPolicy(appId);
    res.json({ success: true, data: policy, timestamp: new Date().toISOString() });
  },
);

adsRouter.put(
  '/frequency/:appId',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const appId = String(req.params['appId'] || '');
    const parsed = UpdateAdFrequencyPolicySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid Frequency Policy payload',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const saved = await upsertAdFrequencyPolicy(appId, parsed.data, {
      uid: req.user?.uid || 'system',
      email: req.user?.email || 'admin@webappypie.com',
    });
    res.json({ success: true, data: saved, timestamp: new Date().toISOString() });
  },
);

// ============================================================
// 8. Content Safety Policies
// ============================================================
adsRouter.get(
  '/safety',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    const policies = await getAdSafetyPolicies();
    res.json({ success: true, data: policies, timestamp: new Date().toISOString() });
  },
);

adsRouter.get(
  '/safety/:appId',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const appId = String(req.params['appId'] || '');
    const policy = await getAdSafetyPolicy(appId);
    res.json({ success: true, data: policy, timestamp: new Date().toISOString() });
  },
);

adsRouter.put(
  '/safety/:appId',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const appId = String(req.params['appId'] || '');
    const parsed = UpdateAdSafetyPolicySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid Safety Policy payload',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const saved = await upsertAdSafetyPolicy(appId, parsed.data, {
      uid: req.user?.uid || 'system',
      email: req.user?.email || 'admin@webappypie.com',
    });
    res.json({ success: true, data: saved, timestamp: new Date().toISOString() });
  },
);

// ============================================================
// 9. Custom Ad Campaigns Endpoints
// ============================================================
adsRouter.get(
  '/custom-campaigns',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    const campaigns = await getCustomAdCampaigns();
    res.json({ success: true, data: campaigns, timestamp: new Date().toISOString() });
  },
);

adsRouter.post(
  '/custom-campaigns',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = CreateCustomAdCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid Custom Campaign payload',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const created = await createCustomAdCampaign(parsed.data, {
      uid: req.user?.uid || 'system',
      email: req.user?.email || 'admin@webappypie.com',
    });
    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() });
  },
);

adsRouter.put(
  '/custom-campaigns/:id',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    const parsed = UpdateCustomAdCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid Custom Campaign update payload',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const updated = await updateCustomAdCampaign(id, parsed.data, {
        uid: req.user?.uid || 'system',
        email: req.user?.email || 'admin@webappypie.com',
      });
      res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

adsRouter.delete(
  '/custom-campaigns/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    try {
      await deleteCustomAdCampaign(id, {
        uid: req.user?.uid || 'system',
        email: req.user?.email || 'admin@webappypie.com',
      });
      res.json({
        success: true,
        message: `Campaign '${id}' deleted successfully.`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// ============================================================
// 10. Kill Switches Endpoints
// ============================================================
adsRouter.get(
  '/kill-switches',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    const switches = await getAdKillSwitches();
    res.json({ success: true, data: switches, timestamp: new Date().toISOString() });
  },
);

const handleKillSwitchesUpdate = async (req: AuthenticatedRequest, res: Response) => {
  const parsed = UpdateAdKillSwitchesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid Kill Switch update payload',
        details: parsed.error.format(),
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const updated = await updateAdKillSwitches(parsed.data, {
    uid: req.user?.uid || 'system',
    email: req.user?.email || 'admin@webappypie.com',
  });
  res.json({
    success: true,
    data: updated,
    message: 'Ads kill switches updated successfully',
    timestamp: new Date().toISOString(),
  });
};

adsRouter.post('/kill-switches', requireRole('admin'), handleKillSwitchesUpdate);
adsRouter.put('/kill-switches', requireRole('admin'), handleKillSwitchesUpdate);

// ============================================================
// 11. Effective Config Preview (Admin Diagnostic)
// ============================================================
adsRouter.get(
  '/effective-config/:appId',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const appId = String(req.params['appId'] || '');
    try {
      const effective = await resolveEffectiveAdConfig(appId);
      res.json({
        success: true,
        data: effective,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'RESOLVE_ERROR', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// ============================================================
// 12. Official Ad Testing Catalog
// ============================================================
adsRouter.get(
  '/test-catalog',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    const catalog = getOfficialAdTestCatalog();
    res.json({
      success: true,
      data: {
        catalog,
      },
      timestamp: new Date().toISOString(),
    });
  },
);

// ============================================================
// 13. Ads Audit Logs
// ============================================================
adsRouter.get(
  '/audit-logs',
  requireRole('admin'),
  async (_req: AuthenticatedRequest, res: Response) => {
    const all = getAuditLogs(100);
    const adsOnly = all.filter(
      (log) => log.action.startsWith('ads.') || log.metadata?.['module'] === 'ads',
    );
    res.json({
      success: true,
      data: adsOnly,
      total: adsOnly.length,
      timestamp: new Date().toISOString(),
    });
  },
);
