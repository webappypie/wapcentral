import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { CreateCampaignSchema } from '@wapcentral/validation';
import type { Campaign, CampaignStatus } from '@wapcentral/types';
import { logAdminAction } from '../services/auditService.js';

export const campaignsRouter: Router = Router();

let memoryCampaigns: Campaign[] = [
  {
    id: 'camp_01',
    name: 'Pie Calc Pro Promo',
    promotedAppId: 'app_02',
    targetAppIds: ['app_01'],
    title: 'Unlock Scientific Functions',
    description: 'Upgrade to Pie Calc Pro for advanced equations',
    ctaText: 'Get 50% Off',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.webappypie.calc',
    layoutVariant: 'banner',
    priority: 90,
    enabled: true,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// GET /v1/campaigns - List campaigns (Viewer+)
campaignsRouter.get('/', requireRole('viewer'), (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: memoryCampaigns,
    total: memoryCampaigns.length,
    timestamp: new Date().toISOString(),
  });
});

// GET /v1/campaigns/:id - Get single campaign (Viewer+)
campaignsRouter.get('/:id', requireRole('viewer'), (req: AuthenticatedRequest, res: Response) => {
  const campaignId = String(req.params['id'] || '');
  const camp = memoryCampaigns.find((c) => c.id === campaignId);
  if (!camp) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Campaign '${campaignId}' not found.` },
      timestamp: new Date().toISOString(),
    });
    return;
  }
  res.json({ success: true, data: camp, timestamp: new Date().toISOString() });
});

// POST /v1/campaigns - Create a campaign (Editor+)
campaignsRouter.post(
  '/',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = CreateCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid campaign data',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const validated = parsed.data;
    const campaignId = `camp_${Date.now()}`;
    const now = new Date().toISOString();

    const newCampaign: Campaign = {
      id: campaignId,
      name: validated.name,
      promotedAppId: validated.promotedAppId,
      targetAppIds: validated.targetAppIds,
      title: validated.title,
      description: validated.description,
      ctaText: validated.ctaText,
      storeUrl: validated.storeUrl,
      ...(validated.imageUrl ? { imageUrl: validated.imageUrl } : {}),
      ...(validated.animationUrl ? { animationUrl: validated.animationUrl } : {}),
      layoutVariant: validated.layoutVariant,
      priority: validated.priority,
      enabled: true,
      status: 'draft',
      ...(validated.frequencyCap ? { frequencyCap: validated.frequencyCap } : {}),
      createdAt: now,
      updatedAt: now,
    };

    memoryCampaigns.unshift(newCampaign);

    if (req.user) {
      await logAdminAction({
        action: 'campaign.create',
        actorUid: req.user.uid,
        actorEmail: req.user.email,
        resourceType: 'campaign',
        resourceId: campaignId,
        changes: { campaign: { before: null, after: newCampaign } },
      });
    }

    res.status(201).json({
      success: true,
      data: newCampaign,
      timestamp: now,
    });
  },
);

// PATCH /v1/campaigns/:id/status - Update campaign status (Editor+)
campaignsRouter.patch(
  '/:id/status',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const campaignId = String(req.params['id'] || '');
    const { status } = req.body || {};

    const validStatuses: CampaignStatus[] = ['draft', 'published', 'paused', 'ended'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Status must be one of: ${validStatuses.join(', ')}`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const campIndex = memoryCampaigns.findIndex((c) => c.id === campaignId);
    if (campIndex === -1) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Campaign '${campaignId}' not found.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const existing = memoryCampaigns[campIndex]!;
    const updatedCamp: Campaign = {
      ...existing,
      status,
      enabled: status === 'published',
      updatedAt: new Date().toISOString(),
    };

    memoryCampaigns[campIndex] = updatedCamp;

    if (req.user) {
      await logAdminAction({
        action: status === 'published' ? 'campaign.publish' : 'campaign.pause',
        actorUid: req.user.uid,
        actorEmail: req.user.email,
        resourceType: 'campaign',
        resourceId: campaignId,
        changes: { campaign: { before: existing.status, after: status } },
      });
    }

    res.json({
      success: true,
      data: updatedCamp,
      timestamp: updatedCamp.updatedAt,
    });
  },
);

// DELETE /v1/campaigns/:id - Delete campaign (Admin+)
campaignsRouter.delete(
  '/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const campaignId = String(req.params['id'] || '');
    const existing = memoryCampaigns.find((c) => c.id === campaignId);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Campaign '${campaignId}' not found.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    memoryCampaigns = memoryCampaigns.filter((c) => c.id !== campaignId);

    if (req.user) {
      await logAdminAction({
        action: 'campaign.pause',
        actorUid: req.user.uid,
        actorEmail: req.user.email,
        resourceType: 'campaign',
        resourceId: campaignId,
        changes: { campaign: { before: existing, after: null } },
      });
    }

    res.json({
      success: true,
      message: `Campaign '${campaignId}' deleted.`,
      timestamp: new Date().toISOString(),
    });
  },
);
