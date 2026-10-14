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
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@wapcentral/ui';
import {
  Cpu,
  Terminal,
  Package,
  ShieldAlert,
  Activity,
  Check,
  X,
  Sliders,
  AlertTriangle,
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
} from '../services/platformService.js';

type Tab = 'services' | 'switches' | 'permissions' | 'apis' | 'sdks';

export const PlatformPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('services');
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

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

  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('super_admin');
  const isEditor = hasRole('editor');

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
      setFeedbackError('Only Super Admins can toggle emergency kill switches.');
      return;
    }
    try {
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
      setFeedbackSuccess(`Kill switch '${category}${key ? `:${key}` : ''}' updated successfully.`);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to toggle kill switch.');
    }
  };

  const handleToggleAppService = async (appId: string, svc: PlatformServiceType) => {
    if (!isEditor) {
      setFeedbackError('Editor permissions required to update service access.');
      return;
    }
    const targetApp = apps.find((a) => a.id === appId);
    if (!targetApp) return;

    const currentServices = targetApp.allowedServices || (targetApp.enabledModules.filter((m) =>
      ['ai', 'image', 'ocr', 'files', 'ads', 'notifications', 'promotion'].includes(m),
    ) as PlatformServiceType[]);

    const updated = currentServices.includes(svc)
      ? currentServices.filter((s) => s !== svc)
      : [...currentServices, svc];

    try {
      await updateAppServicePermissions(appId, updated);
      setFeedbackSuccess(`Updated permissions for ${targetApp.name}: ${svc} is now ${updated.includes(svc) ? 'enabled' : 'disabled'}.`);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to update service permissions.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Services"
        description="Unified management of reusable WAP runtime services, API gateway routes, client SDKs, and global emergency kill switches."
        actions={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Gateway Active
            </span>
          </div>
        }
      />

      {/* Global Feedback */}
      {feedbackSuccess && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-600 flex items-center justify-between">
          <span>{feedbackSuccess}</span>
          <button onClick={() => setFeedbackSuccess(null)} className="text-xs font-bold">DISMISS</button>
        </div>
      )}
      {feedbackError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{feedbackError}</span>
          </div>
          <button onClick={() => setFeedbackError(null)} className="text-xs font-bold">DISMISS</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
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
          onClick={() => setActiveTab('switches')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'switches'
              ? 'bg-rose-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Global Kill Switches</span>
        </button>

        <button
          onClick={() => setActiveTab('permissions')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'permissions'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>App Service Permissions</span>
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
          <span>SDKs Catalog (8)</span>
        </button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          {/* TAB 1: Platform Services */}
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

          {/* TAB 2: Global Kill Switches & Emergency Controls */}
          {activeTab === 'switches' && (
            <div className="space-y-6">
              <Card className="border-rose-200 dark:border-rose-950/60 bg-rose-50/20 dark:bg-rose-950/10">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5" />
                        Global Platform Kill Switch
                      </CardTitle>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Immediately halts ALL inbound Platform API requests across every service, application, and provider.
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
                    {(['ai', 'image', 'ocr', 'files', 'ads', 'notifications', 'promotion'] as PlatformServiceType[]).map((svc) => {
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
                    <CardTitle className="text-sm font-bold">App-Level API Blocks</CardTitle>
                    <p className="text-xs text-slate-500">Block specific rogue or buggy apps from Platform APIs</p>
                  </CardHeader>
                  <CardContent className="space-y-2.5 pt-2">
                    {apps.map((app) => {
                      const appId = app.id;
                      const isKilled = Boolean(killSwitches.apps[appId]);
                      return (
                        <div
                          key={appId}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800"
                        >
                          <div>
                            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">
                              {app.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
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

          {/* TAB 3: App Service Permissions Matrix */}
          {activeTab === 'permissions' && (
            <Card>
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <CardTitle className="text-sm font-bold">App-Specific Platform Service Permissions</CardTitle>
                <p className="text-xs text-slate-500">
                  Manage which applications have authorization to consume specific reusable WAP platform capabilities.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application</TableHead>
                      <TableHead className="text-center">AI Gateway</TableHead>
                      <TableHead className="text-center">Image Intel</TableHead>
                      <TableHead className="text-center">OCR Engine</TableHead>
                      <TableHead className="text-center">Files Intel</TableHead>
                      <TableHead className="text-center">Ads</TableHead>
                      <TableHead className="text-center">Notifications</TableHead>
                      <TableHead className="text-center">Promotion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apps.map((app) => {
                      const allowedList = ((app.allowedServices || app.enabledModules || []) as (PlatformServiceType | string)[]);
                      return (
                        <TableRow key={app.id}>
                          <TableCell>
                            <span className="font-semibold text-xs text-slate-900 dark:text-white block">
                              {app.name}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">{app.id}</span>
                          </TableCell>
                          {(['ai', 'image', 'ocr', 'files', 'ads', 'notifications', 'promotion'] as PlatformServiceType[]).map((svc) => {
                            const isAllowed = allowedList.includes(svc);
                            return (
                              <TableCell key={svc} className="text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAppService(app.id, svc)}
                                  className={`p-1.5 rounded-lg border transition-colors ${
                                    isAllowed
                                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                      : 'border-slate-200 dark:border-slate-800 text-slate-300 hover:text-slate-600'
                                  }`}
                                  title={`${isAllowed ? 'Disable' : 'Enable'} ${svc} for ${app.name}`}
                                >
                                  {isAllowed ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                </button>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: APIs Catalog */}
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
                      <TableHead>Method &amp; Path</TableHead>
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

          {/* TAB 5: SDKs Catalog */}
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
        </>
      )}
    </div>
  );
};

export default PlatformPage;
