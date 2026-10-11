import React, { useState, useEffect } from 'react';
import {
  PageHeader,
  Button,
  Badge,
  Card,
  CardHeader,
  CardContent,
  Spinner,
} from '@wapcentral/ui';
import {
  Bell,
  Send,
  FileText,
  Layers,
  Smartphone,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import type {
  App,
  NotificationDoc,
  NotificationTemplateDoc,
  NotificationCategoryDoc,
  NotificationDeliveryLogDoc,
  NotificationSettingsDoc,
  NotificationCategory,
} from '@wapcentral/types';
import { subscribeApps } from '../services/appsService.js';
import {
  subscribeNotifications,
  subscribeTemplates,
  subscribeCategories,
  subscribeSettings,
  subscribeDeliveryLogs,
  createNotification,
  sendNotification,
  deleteNotification,
  createTemplate,
  deleteTemplate,
  updateCategory,
  updateSettings,
} from '../services/notificationsService.js';

type TabType =
  | 'overview'
  | 'send'
  | 'history'
  | 'templates'
  | 'categories'
  | 'devices'
  | 'logs'
  | 'settings';

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Realtime state
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplateDoc[]>([]);
  const [categories, setCategories] = useState<NotificationCategoryDoc[]>([]);
  const [settings, setSettings] = useState<NotificationSettingsDoc | null>(null);
  const [logs, setLogs] = useState<NotificationDeliveryLogDoc[]>([]);
  const [registeredApps, setRegisteredApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  // Send Form State
  const [sendForm, setSendForm] = useState({
    title: '',
    message: '',
    category: 'SYSTEM' as NotificationCategory,
    type: 'system' as any,
    priority: 'normal' as any,
    targetType: 'all_apps' as any,
    targetAppIds: [] as string[],
    imageUrl: '',
    deepLink: '',
    sound: 'default',
    badge: 1,
    scheduleNow: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubNotifs = subscribeNotifications((items) => setNotifications(items));
    const unsubTmpl = subscribeTemplates((items) => setTemplates(items));
    const unsubCats = subscribeCategories((items) => setCategories(items));
    const unsubSettings = subscribeSettings((s) => setSettings(s));
    const unsubLogs = subscribeDeliveryLogs((l) => setLogs(l));
    const unsubApps = subscribeApps((apps) => {
      setRegisteredApps(apps);
      if (apps.length > 0 && sendForm.targetAppIds.length === 0) {
        setSendForm((prev) => ({
          ...prev,
          targetAppIds: prev.targetAppIds.length > 0 ? prev.targetAppIds : [apps[0]!.id],
        }));
      }
    });

    setLoading(false);

    return () => {
      unsubNotifs();
      unsubTmpl();
      unsubCats();
      unsubSettings();
      unsubLogs();
      unsubApps();
    };
  }, []);

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendForm.title || !sendForm.message) {
      setActionError('Title and message are required.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const payload: any = {
        title: sendForm.title.trim(),
        message: sendForm.message.trim(),
        category: sendForm.category,
        type: sendForm.type,
        priority: sendForm.priority,
        targetType: sendForm.targetType,
        targetAppIds: sendForm.targetType === 'all_apps' ? [] : sendForm.targetAppIds,
        sound: sendForm.sound,
        badge: sendForm.badge,
        isMandatory: false,
      };

      if (sendForm.targetType === 'specific_app' && sendForm.targetAppIds[0]) {
        payload.targetAppId = sendForm.targetAppIds[0];
      }
      if (sendForm.imageUrl && sendForm.imageUrl.trim()) {
        payload.imageUrl = sendForm.imageUrl.trim();
      }
      if (sendForm.deepLink && sendForm.deepLink.trim()) {
        payload.deepLink = sendForm.deepLink.trim();
      }
      if (sendForm.scheduleNow) {
        payload.schedule = 'now';
      }

      const created = await createNotification(payload);

      if (sendForm.scheduleNow) {
        await sendNotification(created.id);
        setActionSuccess(`Notification '${sendForm.title}' sent successfully.`);
      } else {
        setActionSuccess(`Notification '${sendForm.title}' saved as draft.`);
      }

      setSendForm({
        ...sendForm,
        title: '',
        message: '',
        imageUrl: '',
        deepLink: '',
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to send notification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendExisting = async (id: string) => {
    try {
      await sendNotification(id);
      setActionSuccess('Notification sent successfully.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to send');
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (confirm('Delete this notification record?')) {
      await deleteNotification(id);
    }
  };

  // Metrics summary
  const totalSent = notifications.reduce((acc, n) => acc + (n.stats?.sent || 0), 0);
  const totalDelivered = notifications.reduce((acc, n) => acc + (n.stats?.delivered || 0), 0);
  const totalOpened = notifications.reduce((acc, n) => acc + (n.stats?.opened || 0), 0);
  const openRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central Notification System"
        description="Manage FCM push campaigns, in-app bell notifications, categories, and emergency kill switches."
      />

      {/* Global Kill Switch Banner */}
      {settings?.globalNotificationsOff && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6" />
            <div>
              <p className="font-bold">GLOBAL NOTIFICATIONS OFF IS ACTIVE</p>
              <p className="text-sm opacity-90">All push and in-app notifications are currently suppressed across all WebAppyPie applications.</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateSettings({ globalNotificationsOff: false })}
          >
            Disable Kill Switch
          </Button>
        </div>
      )}

      {/* Feedback Messages */}
      {actionSuccess && (
        <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600 border border-emerald-500/30 flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-xs font-bold">DISMISS</button>
        </div>
      )}
      {actionError && (
        <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-600 border border-red-500/30 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-xs font-bold">DISMISS</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 gap-2">
        {[
          { id: 'overview', label: 'Overview', icon: Bell },
          { id: 'send', label: 'Send Notification', icon: Send },
          { id: 'history', label: 'Campaigns & History', icon: Clock },
          { id: 'templates', label: 'Templates', icon: FileText },
          { id: 'categories', label: 'Categories', icon: Layers },
          { id: 'logs', label: 'Delivery Logs', icon: CheckCircle2 },
          { id: 'settings', label: 'Settings & Kill Switches', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <div>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs font-medium text-slate-500">Total Sent</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {totalSent.toLocaleString()}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> FCM Dispatched
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs font-medium text-slate-500">Delivered</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {totalDelivered.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Confirmed Device Delivery</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs font-medium text-slate-500">Opened</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {totalOpened.toLocaleString()}
                    </p>
                    <p className="text-xs text-indigo-500 mt-1">In-App / Notification Clicks</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs font-medium text-slate-500">Open Rate</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {openRate}%
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Engagement Conversion</p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Campaigns Table */}
              <Card>
                <CardHeader title="Recent Notifications" />
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500">
                          <th className="pb-3">Title & Message</th>
                          <th className="pb-3">Category</th>
                          <th className="pb-3">Target Apps</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3">Delivery Stats</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {notifications.slice(0, 5).map((n) => (
                          <tr key={n.id}>
                            <td className="py-3">
                              <p className="font-medium text-slate-900 dark:text-white">{n.title}</p>
                              <p className="text-xs text-slate-500 truncate max-w-xs">{n.message}</p>
                            </td>
                            <td className="py-3">
                              <Badge variant={n.isMandatory ? 'destructive' : 'secondary'}>{n.category}</Badge>
                            </td>
                            <td className="py-3 text-xs text-slate-600 dark:text-slate-300">
                              {n.targetType === 'all_apps' ? 'All Registered Apps' : n.targetAppIds.join(', ')}
                            </td>
                            <td className="py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                n.status === 'sent'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                              }`}>
                                {n.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-3 text-xs text-slate-500">
                              {n.stats?.delivered || 0} del / {n.stats?.opened || 0} open
                            </td>
                            <td className="py-3 text-right">
                              {n.status === 'draft' && (
                                <Button size="sm" variant="outline" onClick={() => handleSendExisting(n.id)}>
                                  Send Now
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: SEND NOTIFICATION WITH PREVIEW */}
          {activeTab === 'send' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form (2 cols) */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader title="Create Notification" />
                  <CardContent>
                    <form onSubmit={handleSendSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Notification Title *
                        </label>
                        <input
                          type="text"
                          required
                          value={sendForm.title}
                          onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
                          placeholder="e.g., Your Export is Complete"
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Message Body *
                        </label>
                        <textarea
                          required
                          rows={3}
                          value={sendForm.message}
                          onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                          placeholder="e.g., Tap to view your processed files..."
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Category
                          </label>
                          <select
                            value={sendForm.category}
                            onChange={(e) => setSendForm({ ...sendForm, category: e.target.value as any })}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                          >
                            <option value="SYSTEM">SYSTEM (Mandatory)</option>
                            <option value="IMPORTANT">IMPORTANT</option>
                            <option value="SECURITY">SECURITY (Mandatory)</option>
                            <option value="UPDATE">UPDATE</option>
                            <option value="FEATURE">FEATURE</option>
                            <option value="PROMOTION">PROMOTION</option>
                            <option value="MAINTENANCE">MAINTENANCE (Mandatory)</option>
                            <option value="CUSTOM">CUSTOM</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Target Apps
                          </label>
                          <select
                            value={sendForm.targetType}
                            onChange={(e) => setSendForm({ ...sendForm, targetType: e.target.value })}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                          >
                            <option value="all_apps">All Registered Apps</option>
                            <option value="specific_app">Specific Application</option>
                          </select>
                        </div>
                      </div>

                      {sendForm.targetType === 'specific_app' && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Select Target Application *
                          </label>
                          <select
                            value={sendForm.targetAppIds[0] || ''}
                            onChange={(e) =>
                              setSendForm({
                                ...sendForm,
                                targetAppIds: e.target.value ? [e.target.value] : [],
                              })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                          >
                            {registeredApps.length === 0 ? (
                              <option value="">No applications registered</option>
                            ) : (
                              registeredApps.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name} ({a.packageId})
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Deep Link (Optional)
                          </label>
                          <input
                            type="text"
                            value={sendForm.deepLink}
                            onChange={(e) => setSendForm({ ...sendForm, deepLink: e.target.value })}
                            placeholder="e.g., filezen://cleanup/summary"
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Image URL (Optional)
                          </label>
                          <input
                            type="url"
                            value={sendForm.imageUrl}
                            onChange={(e) => setSendForm({ ...sendForm, imageUrl: e.target.value })}
                            placeholder="https://..."
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id="scheduleNow"
                          checked={sendForm.scheduleNow}
                          onChange={(e) => setSendForm({ ...sendForm, scheduleNow: e.target.checked })}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="scheduleNow" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Send immediately via FCM to all eligible target devices
                        </label>
                      </div>

                      <div className="pt-4 flex justify-end gap-3">
                        <Button
                          type="submit"
                          disabled={isSubmitting}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {isSubmitting ? 'Sending...' : sendForm.scheduleNow ? 'Send Notification' : 'Save as Draft'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Live Device Preview (1 col) */}
              <div>
                <Card>
                  <CardHeader title="Device Notification Preview" />
                  <CardContent className="flex flex-col items-center">
                    <div className="w-64 rounded-3xl border-4 border-slate-800 bg-slate-900 p-3 shadow-2xl text-white">
                      {/* Notch / Speaker */}
                      <div className="mx-auto h-3 w-20 rounded-full bg-slate-800 mb-3" />

                      {/* Mock Notification Banner */}
                      <div className="rounded-xl bg-slate-800/90 p-3 backdrop-blur shadow-lg border border-slate-700">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <div className="h-4 w-4 rounded-full bg-indigo-500 flex items-center justify-center text-[8px] font-bold">W</div>
                            <span className="text-[10px] font-bold text-slate-300">
                              {registeredApps.find((a) => a.id === sendForm.targetAppIds[0])?.name || 'Mobile App'}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-400">now</span>
                        </div>
                        <p className="text-xs font-bold text-white leading-tight">
                          {sendForm.title || 'Notification Title'}
                        </p>
                        <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">
                          {sendForm.message || 'Notification message will appear here on user lock screen and system tray.'}
                        </p>
                        {sendForm.imageUrl && (
                          <div className="mt-2 h-16 w-full rounded bg-slate-700 overflow-hidden">
                            <img src={sendForm.imageUrl} alt="preview" className="h-full w-full object-cover" />
                          </div>
                        )}
                      </div>

                      <div className="mt-24 text-center">
                        <p className="text-[10px] text-slate-500">Android & iOS Push Preview</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 3: CAMPAIGNS & HISTORY */}
          {activeTab === 'history' && (
            <Card>
              <CardHeader title="All Sent & Draft Notifications" />
              <CardContent>
                <div className="space-y-4">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">{n.title}</span>
                          <Badge variant={n.isMandatory ? 'destructive' : 'secondary'}>{n.category}</Badge>
                          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${
                            n.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {n.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{n.message}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                          <span>Target: {n.targetType}</span>
                          <span>Created: {new Date(n.createdAt).toLocaleDateString()}</span>
                          {n.deepLink && <span>Deep Link: {n.deepLink}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {n.status === 'draft' && (
                          <Button size="sm" onClick={() => handleSendExisting(n.id)}>
                            Send
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteNotification(n.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: TEMPLATES */}
          {activeTab === 'templates' && (
            <Card>
              <CardHeader title="Notification Templates" />
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 dark:text-white">{tmpl.name}</h4>
                        <Badge variant="secondary">{tmpl.category}</Badge>
                      </div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{tmpl.title}</p>
                      <p className="text-xs text-slate-500">{tmpl.body}</p>
                      <div className="text-[10px] text-slate-400">
                        Variables: {tmpl.variables?.join(', ') || 'None'}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 5: CATEGORIES */}
          {activeTab === 'categories' && (
            <Card>
              <CardHeader title="Notification Categories & Opt-out Rules" />
              <CardContent>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {categories.map((cat) => (
                    <div key={cat.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">{cat.name}</span>
                          <span className="text-xs font-mono text-slate-400">({cat.id})</span>
                          {cat.isMandatory && (
                            <Badge variant="destructive">Mandatory / Cannot Opt Out</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Default: Enabled</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 6: DELIVERY LOGS */}
          {activeTab === 'logs' && (
            <Card>
              <CardHeader title="FCM Message Delivery Audit Trail" />
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500">
                        <th className="pb-3">Timestamp</th>
                        <th className="pb-3">Notification ID</th>
                        <th className="pb-3">Target App</th>
                        <th className="pb-3">Masked Device Identifier</th>
                        <th className="pb-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
                      {logs.slice(0, 25).map((l) => (
                        <tr key={l.id}>
                          <td className="py-2.5 text-slate-500">{new Date(l.timestamp).toLocaleTimeString()}</td>
                          <td className="py-2.5 text-slate-700 dark:text-slate-300">{l.notificationId}</td>
                          <td className="py-2.5">{l.appId}</td>
                          <td className="py-2.5 text-slate-400">{l.deviceIdentifier}</td>
                          <td className="py-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              l.status === 'sent' || l.status === 'delivered'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {l.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No delivery logs recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 7: SETTINGS & KILL SWITCHES */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <Card>
                <CardHeader title="Emergency Kill Switches" />
                <CardContent className="space-y-6">
                  {/* Master Switch */}
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">GLOBAL NOTIFICATIONS OFF</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Instantly shuts off all push notification delivery and suppresses bell notifications across all apps.
                      </p>
                    </div>
                    <Button
                      variant={settings?.globalNotificationsOff ? 'destructive' : 'outline'}
                      onClick={() =>
                        updateSettings({ globalNotificationsOff: !settings?.globalNotificationsOff })
                      }
                    >
                      {settings?.globalNotificationsOff ? 'KILL SWITCH ACTIVE (ON)' : 'DISABLE ALL NOTIFICATIONS'}
                    </Button>
                  </div>

                  {/* App Level Switches */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">App-Level Notification Kill Switches</h4>
                    {registeredApps.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No applications registered yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {registeredApps.map((app) => {
                          const appId = app.id;
                          const isKilled = !!settings?.appKillSwitches?.[appId];
                          return (
                             <div
                              key={appId}
                              className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between"
                            >
                              <div>
                                <span className="font-semibold text-sm">{app.name}</span>
                                <span className="block font-mono text-[10px] text-slate-400">{app.packageId}</span>
                              </div>
                              <Button
                                size="sm"
                                variant={isKilled ? 'destructive' : 'outline'}
                                onClick={() =>
                                  updateSettings({
                                    appKillSwitches: {
                                      ...settings?.appKillSwitches,
                                      [appId]: !isKilled,
                                    },
                                  })
                                }
                              >
                                {isKilled ? 'Suppressed (OFF)' : 'Active (ON)'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
