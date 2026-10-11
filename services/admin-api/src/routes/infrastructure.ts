import { Router } from 'express';
import type { Response } from 'express';
import { requireRole } from '../middleware/rbac.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import {
  buildInfrastructureReport,
  probeFirestoreHealth,
  collectCloudRunHealth,
  collectSecretManagerHealth,
  collectCloudSchedulerHealth,
} from '../services/infrastructureCollector.js';
import { getFirestoreDb } from '../services/firestore.js';
import { COLLECTIONS } from '@wapcentral/config';
import { CreateInfrastructureAlertRuleSchema } from '@wapcentral/validation';
import { logAdminAction } from '../services/auditService.js';

export const infrastructureRouter: Router = Router();

// GET /v1/infrastructure/overview - Complete real production health report (Viewer+)
infrastructureRouter.get(
  ['/', '/overview'],
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const report = await buildInfrastructureReport();
      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            err instanceof Error ? err.message : 'Failed to collect production infrastructure health',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// POST /v1/infrastructure/probe - Trigger real on-demand probe of all components (Admin+)
infrastructureRouter.post(
  '/probe',
  requireRole('admin'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const report = await buildInfrastructureReport();

      // Persist snapshot to Firestore
      try {
        const db = getFirestoreDb();
        for (const svc of report.services) {
          const docRef = db.collection(COLLECTIONS.HEALTH_CHECKS).doc(svc.serviceId);
          await docRef.set({ ...svc, lastCheckedAt: new Date() }, { merge: true });
        }
      } catch {
        // Continue even if logging snapshot fails
      }

      res.json({
        success: true,
        data: report,
        message: 'All production infrastructure components probed successfully.',
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'PROBE_FAILED',
          message: err instanceof Error ? err.message : 'Failed to probe infrastructure components',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// Alert Rules: GET /v1/infrastructure/alerts/rules
infrastructureRouter.get(
  '/alerts/rules',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getFirestoreDb();
      const snap = await db.collection(COLLECTIONS.INFRASTRUCTURE_ALERTS).get();
      const rules = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      res.json({
        success: true,
        data: rules,
        total: rules.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to retrieve alert rules',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// Alert Rules: POST /v1/infrastructure/alerts/rules (Admin+)
infrastructureRouter.post(
  '/alerts/rules',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validated = CreateInfrastructureAlertRuleSchema.parse(req.body);
      const ruleId = `rule_infra_${Date.now()}`;
      const now = new Date().toISOString();

      const actorUid = req.user?.uid ? String(req.user.uid) : 'usr_admin';
      const actorEmail = req.user?.email ? String(req.user.email) : 'admin@webappypie.com';

      const newRule = {
        id: ruleId,
        ...validated,
        createdAt: now,
        updatedAt: now,
      };

      const db = getFirestoreDb();
      await db.collection(COLLECTIONS.INFRASTRUCTURE_ALERTS).doc(ruleId).set(newRule);

      await logAdminAction({
        action: 'flag.update',
        actorUid,
        actorEmail,
        resourceType: 'infra_alert_rule',
        resourceId: ruleId,
        changes: { rule: { before: null, after: newRule } },
      });

      res.status(201).json({
        success: true,
        data: newRule,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err instanceof Error ? err.message : 'Invalid alert rule input',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// Alert Rules: PATCH /v1/infrastructure/alerts/rules/:id (Admin+)
infrastructureRouter.patch(
  '/alerts/rules/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const rawId = req.params['id'];
      const id = typeof rawId === 'string' ? rawId : String(rawId || '');
      const db = getFirestoreDb();
      const docRef = db.collection(COLLECTIONS.INFRASTRUCTURE_ALERTS).doc(id);
      const snap = await docRef.get();

      if (!snap.exists) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Alert rule '${id}' does not exist.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updates = {
        ...req.body,
        updatedAt: new Date().toISOString(),
      };
      delete updates.id;
      delete updates.createdAt;

      await docRef.set(updates, { merge: true });

      const actorUid = req.user?.uid ? String(req.user.uid) : 'usr_admin';
      const actorEmail = req.user?.email ? String(req.user.email) : 'admin@webappypie.com';

      await logAdminAction({
        action: 'flag.update',
        actorUid,
        actorEmail,
        resourceType: 'infra_alert_rule',
        resourceId: id,
        changes: { updates },
      });

      const updatedSnap = await docRef.get();
      res.json({
        success: true,
        data: { id: updatedSnap.id, ...(updatedSnap.data() || {}) },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to update alert rule',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// Alert Rules: DELETE /v1/infrastructure/alerts/rules/:id (Super Admin)
infrastructureRouter.delete(
  '/alerts/rules/:id',
  requireRole('super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const rawId = req.params['id'];
      const id = typeof rawId === 'string' ? rawId : String(rawId || '');
      const db = getFirestoreDb();
      const docRef = db.collection(COLLECTIONS.INFRASTRUCTURE_ALERTS).doc(id);
      const snap = await docRef.get();

      if (!snap.exists) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Alert rule '${id}' does not exist.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await docRef.delete();

      const actorUid = req.user?.uid ? String(req.user.uid) : 'usr_admin';
      const actorEmail = req.user?.email ? String(req.user.email) : 'admin@webappypie.com';

      await logAdminAction({
        action: 'flag.update',
        actorUid,
        actorEmail,
        resourceType: 'infra_alert_rule',
        resourceId: id,
        changes: { rule: { before: snap.data() || {}, after: null } },
      });

      res.json({
        success: true,
        message: `Alert rule '${id}' deleted successfully.`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to delete alert rule',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);
