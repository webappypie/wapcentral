import { Router } from 'express';
import type { Response } from 'express';
import {
  CreateNotificationSchema,
  UpdateNotificationSchema,
  CreateNotificationTemplateSchema,
  UpdateNotificationTemplateSchema,
  UpdateNotificationSettingsSchema,
} from '@wapcentral/validation';
import type { AuthenticatedRequest } from '../types/auth.js';
import { requireRole } from '../middleware/rbac.js';
import {
  getNotificationOverview,
  listNotifications,
  createNotification,
  getNotification,
  updateNotification,
  deleteNotification,
  sendNotification,
  scheduleNotification,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getNotificationCategories,
  updateNotificationCategory,
  listRegisteredDevices,
  listDeliveryLogs,
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationActor,
} from '../services/notificationService.js';

function getActor(req: AuthenticatedRequest): NotificationActor {
  return {
    id: req.user?.uid || 'unknown',
    email: req.user?.email || undefined,
    role: req.user?.role || undefined,
  };
}

export const notificationsRouter: Router = Router();

// ============================================================
// 1. Overview & Analytics
// ============================================================
notificationsRouter.get(
  '/overview',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const overview = await getNotificationOverview();
      res.json({
        success: true,
        data: overview,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch notification overview';
      res.status(500).json({ success: false, error: { code: 'OVERVIEW_ERROR', message } });
    }
  },
);

// ============================================================
// 2. Settings & Kill Switches
// ============================================================
notificationsRouter.get(
  '/settings',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const settings = await getNotificationSettings();
      res.json({ success: true, data: settings, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch settings';
      res.status(500).json({ success: false, error: { code: 'SETTINGS_ERROR', message } });
    }
  },
);

notificationsRouter.put(
  '/settings',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = UpdateNotificationSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid settings payload', details: parsed.error.format() },
      });
      return;
    }

    try {
      const updated = await updateNotificationSettings(parsed.data, getActor(req));
      res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update settings';
      res.status(500).json({ success: false, error: { code: 'SETTINGS_UPDATE_ERROR', message } });
    }
  },
);

// ============================================================
// 3. Templates CRUD
// ============================================================
notificationsRouter.get(
  '/templates',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const templates = await listTemplates();
      res.json({ success: true, data: templates, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch templates';
      res.status(500).json({ success: false, error: { code: 'TEMPLATES_ERROR', message } });
    }
  },
);

notificationsRouter.post(
  '/templates',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = CreateNotificationTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid template payload', details: parsed.error.format() },
      });
      return;
    }

    try {
      const template = await createTemplate(parsed.data, getActor(req));
      res.status(201).json({ success: true, data: template, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create template';
      res.status(500).json({ success: false, error: { code: 'TEMPLATE_CREATE_ERROR', message } });
    }
  },
);

notificationsRouter.put(
  '/templates/:id',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    const parsed = UpdateNotificationTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid template update payload', details: parsed.error.format() },
      });
      return;
    }

    try {
      const updated = await updateTemplate(id, parsed.data, getActor(req));
      res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update template';
      res.status(500).json({ success: false, error: { code: 'TEMPLATE_UPDATE_ERROR', message } });
    }
  },
);

notificationsRouter.delete(
  '/templates/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    try {
      await deleteTemplate(id, getActor(req));
      res.json({ success: true, message: `Template '${id}' deleted.`, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete template';
      res.status(500).json({ success: false, error: { code: 'TEMPLATE_DELETE_ERROR', message } });
    }
  },
);

// ============================================================
// 4. Categories Management
// ============================================================
notificationsRouter.get(
  '/categories',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const categories = await getNotificationCategories();
      res.json({ success: true, data: categories, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch categories';
      res.status(500).json({ success: false, error: { code: 'CATEGORIES_ERROR', message } });
    }
  },
);

notificationsRouter.put(
  '/categories/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '') as any;
    try {
      const updated = await updateNotificationCategory(id, req.body, getActor(req));
      res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update category';
      res.status(500).json({ success: false, error: { code: 'CATEGORY_UPDATE_ERROR', message } });
    }
  },
);

// ============================================================
// 5. Registered Devices (Privacy-safe)
// ============================================================
notificationsRouter.get(
  '/devices',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const appId = req.query['appId'] ? String(req.query['appId']) : undefined;
      const limit = req.query['limit'] ? Number(req.query['limit']) : 50;
      const devices = await listRegisteredDevices(appId, limit);
      res.json({ success: true, data: devices, count: devices.length, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch devices';
      res.status(500).json({ success: false, error: { code: 'DEVICES_ERROR', message } });
    }
  },
);

// ============================================================
// 6. Delivery Logs
// ============================================================
notificationsRouter.get(
  '/logs',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const notificationId = req.query['notificationId'] ? String(req.query['notificationId']) : undefined;
      const appId = req.query['appId'] ? String(req.query['appId']) : undefined;
      const limit = req.query['limit'] ? Number(req.query['limit']) : 100;
      const logs = await listDeliveryLogs({ notificationId, appId, limit });
      res.json({ success: true, data: logs, count: logs.length, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch logs';
      res.status(500).json({ success: false, error: { code: 'LOGS_ERROR', message } });
    }
  },
);

// ============================================================
// 7. Notifications Core CRUD & Sending
// ============================================================
notificationsRouter.get(
  '/',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const appId = req.query['appId'] ? String(req.query['appId']) : undefined;
      const category = req.query['category'] ? (String(req.query['category']) as any) : undefined;
      const status = req.query['status'] ? String(req.query['status']) : undefined;
      const page = req.query['page'] ? Number(req.query['page']) : 1;
      const limit = req.query['limit'] ? Number(req.query['limit']) : 50;

      const result = await listNotifications({ appId, category, status, page, limit });
      res.json({ success: true, ...result, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list notifications';
      res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message } });
    }
  },
);

notificationsRouter.post(
  '/',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = CreateNotificationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid notification payload', details: parsed.error.format() },
      });
      return;
    }

    try {
      const notification = await createNotification(parsed.data, getActor(req));

      // If scheduled as 'now' or immediate send requested, trigger send immediately
      if (parsed.data.schedule === 'now' || (!parsed.data.schedule && req.query['send'] === 'true')) {
        const sendRes = await sendNotification(notification.id, {
          id: req.user?.uid || 'unknown',
          email: req.user?.email,
          role: req.user?.role,
        });
        res.status(201).json({
          success: true,
          data: sendRes.notification,
          sent: true,
          dispatchResult: sendRes.dispatchResult,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(201).json({ success: true, data: notification, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create notification';
      res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message } });
    }
  },
);

notificationsRouter.get(
  '/:id',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    try {
      const notification = await getNotification(id);
      if (!notification) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Notification '${id}' not found.` } });
        return;
      }
      res.json({ success: true, data: notification, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch notification';
      res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message } });
    }
  },
);

notificationsRouter.put(
  '/:id',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    const parsed = UpdateNotificationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid notification update payload', details: parsed.error.format() },
      });
      return;
    }

    try {
      const updated = await updateNotification(id, parsed.data, getActor(req));
      res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update notification';
      res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message } });
    }
  },
);

notificationsRouter.delete(
  '/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    try {
      await deleteNotification(id, getActor(req));
      res.json({ success: true, message: `Notification '${id}' deleted.`, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete notification';
      res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message } });
    }
  },
);

notificationsRouter.post(
  '/:id/send',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    try {
      const result = await sendNotification(id, getActor(req));
      if (!result.success) {
        res.status(502).json({
          success: false,
          data: result.notification,
          dispatchResult: result.dispatchResult,
          error: {
            code: 'FCM_DELIVERY_FAILED',
            message: 'Push notification delivery failed for all target devices.',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      res.json({ success: true, data: result.notification, dispatchResult: result.dispatchResult, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send notification';
      res.status(500).json({ success: false, error: { code: 'SEND_ERROR', message } });
    }
  },
);

notificationsRouter.post(
  '/:id/schedule',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params['id'] || '');
    const scheduledTime = String(req.body?.scheduledTime || req.body?.schedule || '');
    if (!scheduledTime) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'scheduledTime is required' } });
      return;
    }

    try {
      const updated = await scheduleNotification(id, scheduledTime, getActor(req));
      res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to schedule notification';
      res.status(500).json({ success: false, error: { code: 'SCHEDULE_ERROR', message } });
    }
  },
);
