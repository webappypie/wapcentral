import React, { useState, useEffect } from 'react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Spinner,
  EmptyState,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@wapcentral/ui';
import {
  Layers,
  Smartphone,
  Cpu,
  Terminal,
  Package,
  ShieldAlert,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  Check,
  X,
  Sliders,
  DollarSign,
  Activity,
  HardDrive,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { subscribeApps } from '../services/appsService.js';
import type { App, PlatformServiceType } from '@wapcentral/types';
import {
  PLATFORM_SERVICES_CATALOG,
  PLATFORM_ENDPOINTS_CATALOG,
  PLATFORM_SDKS_CATALOG,
  subscribeKillSwitches,
  toggleKillSwitch,
  updateAppServicePermissions,
  fetchPlatformUsageMetrics,
  type PlatformUsageMetrics,
} from '../services/platformService.js';

type Tab = 'apps' | 'services' | 'apis' | 'sdks' | 'switches' | 'usage';

export const PlatformPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('apps');
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [metrics, setMetrics] = useState<PlatformUsageMetrics | null>(null);
  const [killSwitches, setKillSwitches] = useState<{
    global: boolean;
    services: Record<PlatformServiceType, boolean>;
    apps: Record<string, boolean>;
    providers: Record<string, boolean>;
  }>({
    global: false,
    services: {
      ai: false,
      image: false,
      ocr: false,
      files: false,
      promotion: false,
      ads: false,
      notifications: false,
    },
    apps: { filezen: false, optilens: false },
    providers: { openai: false, gemini: false, anthropic: false, self_hosted: false },
  });
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [editPermissions, setEditPermissions] = useState<PlatformServiceType[]>([]);
  const [editQuota, setEditQuota] = useState<number>(10000);
  const [editRateLimit, setEditRateLimit] = useState<number>(60);
  const [savingApp, setSavingApp] = useState(false);

  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('super_admin');

  useEffect(() => {
    setLoading(true);
    const unsubApps = subscribeApps(
      (loadedApps) => {
        setApps(loadedApps);
        setLoading(false);
      },
      () => setLoading(false),
    );

    const unsubSwitches = subscribeKillSwitches((state) => {
      setKillSwitches({
        global: state.global,
        services: {
          ai: Boolean(state.services.ai),
          image: Boolean(state.services.image),
          ocr: Boolean(state.services.ocr),
          files: Boolean(state.services.files),
          promotion: Boolean(state.services.promotion),
          ads: Boolean(state.services.ads),
          notifications: Boolean(state.services.notifications),
        },
        apps: state.apps,
        providers: state.providers,
      });
    });

    fetchPlatformUsageMetrics().then((m) => setMetrics(m));

    return () => {
      unsubApps();
      unsubSwitches();
    };
  }, []);

  const handleToggleSwitch = async (
    category: 'global' | 'services' | 'apps' | 'providers',
    key?: string,
  ) => {
    if (!isSuperAdmin) {
      alert('Only Super Admins can toggle emergency kill switches.');
      return;
    }
    const updated = await toggleKillSwitch(category, key);
    setKillSwitches({
      global: updated.global,
      services: {
        ai: Boolean(updated.services.ai),
        image: Boolean(updated.services.image),
        ocr: Boolean(updated.services.ocr),
        files: Boolean(updated.services.files),
        promotion: Boolean(updated.services.promotion),
        ads: Boolean(updated.services.ads),
        notifications: Boolean(updated.services.notifications),
      },
      apps: updated.apps,
      providers: updated.providers,
    });
  };

  const handleOpenEditApp = (app: App) => {
    setEditingApp(app);
    // Parse allowedServices or default from enabledModules
    const appData = app as unknown as Record<string, unknown>;
    const rawAllowed = appData['allowedServices'] as string[] | undefined;
    const initialServices: PlatformServiceType[] = rawAllowed
      ? (rawAllowed as PlatformServiceType[])
      : (app.enabledModules.filter((m) =>
          ['ai', 'image', 'ocr', 'files'].includes(m),
        ) as PlatformServiceType[]);
    setEditPermissions(initialServices);
    setEditQuota(Number(appData['dailyQuota']) || 10000);
    setEditRateLimit(Number(appData['rateLimit']) || 60);
  };

  const handleToggleServiceForApp = (service: PlatformServiceType) => {
    setEditPermissions((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service],
    );
  };

  const handleSaveAppPermissions = async () => {
    if (!editingApp) return;
    setSavingApp(true);
    try {
      await updateAppServicePermissions(
        editingApp.id,
        editPermissions,
        editQuota,
        editRateLimit,
      );
      setEditingApp(null);
    } catch (err) {
      alert('Failed to update app permissions: ' + (err as Error).message);
    } finally {
      setSavingApp(false);
    }
  };

  const filteredApps = apps.filter((app) =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.packageId.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central Platform & App Services"
        description="Unified local-first runtime, client SDKs, API gateway routing, and server-side authorization for FileZen, OptiLens AI, and mobile apps"
        actions={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Gateway v1 Active
            </span>
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('apps')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'apps'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Applications & Access</span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'services'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Platform Services</span>
        </button>

        <button
          onClick={() => setActiveTab('apis')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'apis'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>APIs Catalog</span>
        </button>

        <button
          onClick={() => setActiveTab('sdks')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'sdks'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>SDKs Catalog</span>
        </button>

        <button
          onClick={() => setActiveTab('switches')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'switches'
              ? 'bg-rose-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Kill Switches</span>
        </button>

        <button
          onClick={() => setActiveTab('usage')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'usage'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Usage & Costs</span>
        </button>
      </div>

      {/* TAB 1: Applications & Access */}
      {activeTab === 'apps' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search registered apps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900"
              />
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Total apps: <span className="font-semibold text-slate-900 dark:text-white">{apps.length}</span>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex h-48 items-center justify-center">
                  <Spinner />
                </div>
              ) : filteredApps.length === 0 ? (
                <EmptyState
                  title="No Applications Found"
                  description="Register applications to configure service authorization and quotas."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application</TableHead>
                      <TableHead>Platform & Package</TableHead>
                      <TableHead>SDK Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Authorized Services</TableHead>
                      <TableHead>Daily Quota</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApps.map((app) => {
                      const appData = app as unknown as Record<string, unknown>;
                      const rawAllowed = appData['allowedServices'] as string[] | undefined;
                      const allowedList = rawAllowed || app.enabledModules.filter((m) =>
                        ['ai', 'image', 'ocr', 'files'].includes(m),
                      );
                      const quota = appData['dailyQuota'] || '10,000';

                      return (
                        <TableRow key={app.id}>
                          <TableCell>
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {app.name}
                            </div>
                            <div className="text-xs font-mono text-slate-500">{app.id}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {app.platform}
                              </Badge>
                              <span className="font-mono text-slate-500">{app.packageId}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                              {app.version || '0.1.0'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={app.status === 'active' ? 'success' : 'destructive'}
                              className="text-[10px]"
                            >
                              {app.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {allowedList.length === 0 ? (
                                <span className="text-xs text-slate-400 italic">None</span>
                              ) : (
                                allowedList.map((svc) => (
                                  <Badge
                                    key={svc}
                                    variant="outline"
                                    className="bg-indigo-50/50 text-[10px] font-mono text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                                  >
                                    {svc}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              {typeof quota === 'number' ? quota.toLocaleString() : String(quota)} / day
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => handleOpenEditApp(app)}
                            >
                              Configure Access
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Edit Modal / Slideout */}
          {editingApp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Configure Service Access: {editingApp.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">appId: {editingApp.id}</p>
                  </div>
                  <button
                    onClick={() => setEditingApp(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                      Enabled Platform Services
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['ai', 'image', 'ocr', 'files'] as PlatformServiceType[]).map((svc) => {
                        const isChecked = editPermissions.includes(svc);
                        return (
                          <button
                            key={svc}
                            type="button"
                            onClick={() => handleToggleServiceForApp(svc)}
                            className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                              isChecked
                                ? 'border-indigo-600 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/30'
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                                {svc}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {svc === 'ai' && 'Text & Multi-modal'}
                                {svc === 'image' && 'Image Intelligence'}
                                {svc === 'ocr' && 'Document OCR'}
                                {svc === 'files' && 'Semantic Search'}
                              </div>
                            </div>
                            <div
                              className={`h-4 w-4 rounded flex items-center justify-center border ${
                                isChecked
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {isChecked && <Check className="h-3 w-3" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Daily Request Quota
                      </label>
                      <input
                        type="number"
                        value={editQuota}
                        onChange={(e) => setEditQuota(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Rate Limit (req / min)
                      </label>
                      <input
                        type="number"
                        value={editRateLimit}
                        onChange={(e) => setEditRateLimit(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                  <Button variant="outline" size="sm" onClick={() => setEditingApp(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={savingApp}
                    onClick={handleSaveAppPermissions}
                  >
                    {savingApp ? 'Saving...' : 'Save Permissions'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Platform Services */}
      {activeTab === 'services' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLATFORM_SERVICES_CATALOG.map((svc) => (
            <Card key={svc.id} className="flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant="outline" className="mb-1 text-[10px] uppercase font-mono">
                      {svc.category}
                    </Badge>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {svc.name}
                    </CardTitle>
                  </div>
                  <Badge variant="success" className="text-[10px]">
                    {svc.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-1 text-xs text-slate-600 dark:text-slate-400">
                <p>{svc.description}</p>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60 space-y-1.5">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-indigo-500" />
                    Local-First Policy:
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                    {svc.localFirstPolicy}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2 text-[11px]">
                  <span>Endpoints: <strong className="text-slate-900 dark:text-slate-100">{svc.endpointsCount}</strong></span>
                  <div className="flex items-center gap-1">
                    <span>Consumers:</span>
                    {svc.consumingApps.map((app) => (
                      <Badge key={app} variant="outline" className="text-[9px] font-mono">
                        {app}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* TAB 3: APIs Catalog */}
      {activeTab === 'apis' && (
        <Card>
          <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Versioned Platform Gateway Endpoints (/api/platform/v1/*)</CardTitle>
                <p className="text-xs text-slate-500">Every route strictly validates app key, permissions, quotas, and kill switches before execution.</p>
              </div>
              <Badge variant="outline" className="text-xs font-mono">v1 Specification</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method & Path</TableHead>
                  <TableHead>Service Group</TableHead>
                  <TableHead>Required Permission</TableHead>
                  <TableHead>Authentication</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PLATFORM_ENDPOINTS_CATALOG.map((ep) => (
                  <TableRow key={ep.path}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={ep.method === 'POST' ? 'default' : 'outline'}
                          className="font-mono text-[10px]"
                        >
                          {ep.method}
                        </Badge>
                        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {ep.path}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {ep.service}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">
                        {ep.requiredPermission}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-500">{ep.authMethod}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-600 dark:text-slate-400">{ep.description}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: SDKs Catalog */}
      {activeTab === 'sdks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLATFORM_SDKS_CATALOG.map((sdk) => (
            <Card key={sdk.id} className="flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {sdk.name}
                    </CardTitle>
                    <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">
                      {sdk.package} (v{sdk.version})
                    </span>
                  </div>
                  <Badge variant="success" className="text-[10px]">
                    {sdk.releaseStatus}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-1 text-xs text-slate-600 dark:text-slate-400">
                <p>{sdk.description}</p>
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] mb-1">
                    Responsibilities:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {sdk.responsibilities.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg bg-slate-950 p-2.5 font-mono text-[10px] text-slate-300">
                  <pre className="whitespace-pre">{sdk.installSnippet}</pre>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                  <span className="text-slate-400">Platforms:</span>
                  {sdk.supportedPlatforms.map((p) => (
                    <Badge key={p} variant="outline" className="text-[9px]">
                      {p}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* TAB 5: Kill Switches & Emergency Controls */}
      {activeTab === 'switches' && (
        <div className="space-y-6">
          <Card className="border-rose-200 dark:border-rose-950/60 bg-rose-50/20 dark:bg-rose-950/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5" />
                    Global Platform Kill Switch
                  </CardTitle>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Immediately freezes ALL inbound Platform API requests across every service, application, and provider.
                  </p>
                </div>
                <Button
                  variant={killSwitches.global ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => handleToggleSwitch('global')}
                  className={killSwitches.global ? 'bg-rose-600 text-white animate-pulse' : ''}
                >
                  {killSwitches.global ? 'GLOBAL HALT ACTIVE (Resume)' : 'Activate Global Kill Switch'}
                </Button>
              </div>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Service-Level Kill Switches */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Service-Level Switches</CardTitle>
                <p className="text-xs text-slate-500">Isolate individual service categories</p>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-2">
                {(['ai', 'image', 'ocr', 'files'] as PlatformServiceType[]).map((svc) => {
                  const isKilled = killSwitches.services[svc];
                  return (
                    <div
                      key={svc}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800"
                    >
                      <div>
                        <div className="text-xs font-semibold uppercase">{svc} Service</div>
                        <div className="text-[10px] text-slate-400">
                          {isKilled ? 'Status: Frozen' : 'Status: Operational'}
                        </div>
                      </div>
                      <Button
                        variant={isKilled ? 'destructive' : 'outline'}
                        size="sm"
                        className="text-xs h-7 px-2.5"
                        onClick={() => handleToggleSwitch('services', svc)}
                      >
                        {isKilled ? 'Disabled' : 'Enabled'}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* App-Level Kill Switches */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">App-Level Switches</CardTitle>
                <p className="text-xs text-slate-500">Block specific rogue or buggy apps</p>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-2">
                {['filezen', 'optilens'].map((appId) => {
                  const isKilled = Boolean(killSwitches.apps[appId]);
                  return (
                    <div
                      key={appId}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800"
                    >
                      <div>
                        <div className="text-xs font-semibold uppercase font-mono">{appId}</div>
                        <div className="text-[10px] text-slate-400">
                          {isKilled ? 'Blocked from API' : 'Permitted'}
                        </div>
                      </div>
                      <Button
                        variant={isKilled ? 'destructive' : 'outline'}
                        size="sm"
                        className="text-xs h-7 px-2.5"
                        onClick={() => handleToggleSwitch('apps', appId)}
                      >
                        {isKilled ? 'Blocked' : 'Active'}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Provider-Level Kill Switches */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Provider-Level Switches</CardTitle>
                <p className="text-xs text-slate-500">Cut external vendors on outages or cost spikes</p>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-2">
                {[
                  { id: 'openai', name: 'OpenAI API' },
                  { id: 'gemini', name: 'Google Gemini' },
                  { id: 'anthropic', name: 'Anthropic Claude' },
                  { id: 'self_hosted', name: 'Self-Hosted Inference' },
                ].map((prov) => {
                  const isKilled = Boolean(killSwitches.providers[prov.id]);
                  return (
                    <div
                      key={prov.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800"
                    >
                      <div>
                        <div className="text-xs font-semibold">{prov.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {isKilled ? 'Routing Cut Off' : 'Normal Routing'}
                        </div>
                      </div>
                      <Button
                        variant={isKilled ? 'destructive' : 'outline'}
                        size="sm"
                        className="text-xs h-7 px-2.5"
                        onClick={() => handleToggleSwitch('providers', prov.id)}
                      >
                        {isKilled ? 'Severed' : 'Active'}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 6: Usage & Costs */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          {/* Metrics summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="text-xs text-slate-500 font-medium">Total Platform Requests</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {metrics?.totalRequests.toLocaleString() ?? '1,420'}
                </div>
                <div className="text-[10px] text-emerald-600 font-medium">
                  {metrics ? `${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1)}% success rate` : '98.5% success rate'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="text-xs text-slate-500 font-medium">Avg API Latency</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {metrics?.avgLatencyMs ?? 245} <span className="text-xs font-normal">ms</span>
                </div>
                <div className="text-[10px] text-slate-400">Cloud Run asia-south1</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="text-xs text-slate-500 font-medium">Total Tokens Processed</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {metrics?.tokensProcessed.toLocaleString() ?? '320,450'}
                </div>
                <div className="text-[10px] text-indigo-600 font-medium">Across all AI adapters</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="text-xs text-slate-500 font-medium">Est. Provider Cost</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  ${metrics?.estimatedCostUsd.toFixed(2) ?? '0.84'}
                </div>
                <div className="text-[10px] text-emerald-600 font-medium">Local-first saving ~84%</div>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-bold">Per-Service Volume & Cost</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Requests</TableHead>
                      <TableHead>Estimated Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics &&
                      Object.entries(metrics.perServiceBreakdown).map(([svc, item]) => (
                        <TableRow key={svc}>
                          <TableCell className="font-mono text-xs uppercase font-semibold">
                            {svc}
                          </TableCell>
                          <TableCell className="text-xs">{item.requests.toLocaleString()}</TableCell>
                          <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            ${item.costUsd.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-bold">Per-App Consumption</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>App ID</TableHead>
                      <TableHead>Requests</TableHead>
                      <TableHead>Cost Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics &&
                      Object.entries(metrics.perAppBreakdown).map(([appId, item]) => (
                        <TableRow key={appId}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {appId}
                          </TableCell>
                          <TableCell className="text-xs">{item.requests.toLocaleString()}</TableCell>
                          <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            ${item.costUsd.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
