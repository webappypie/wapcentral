import React, { useState, useEffect } from 'react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Spinner,
  EmptyState,
  ErrorState,
  Button,
  Modal,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@wapcentral/ui';
import {
  Megaphone,
  CheckCircle2,
  Layers,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Save,
  ShieldCheck,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import type {
  App,
  AdUnit,
  AdPlacement,
  AdNetworkType,
  Platform,
  AdUnitType,
} from '@wapcentral/types';
import { subscribeApps, updateApp } from '../services/appsService.js';
import { useAuth } from '../contexts/AuthContext.js';

type ViewState = 'content' | 'loading' | 'empty' | 'error';
type ActiveTab = 'registry' | 'waterfall';

export const AdsPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');
  const [activeTab, setActiveTab] = useState<ActiveTab>('waterfall');
  const [apps, setApps] = useState<App[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Add unit modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUnitNetwork, setNewUnitNetwork] = useState<'admob' | 'meta' | 'applovin'>('admob');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitType, setNewUnitType] = useState<AdUnitType>('banner');
  const [newUnitPlatform, setNewUnitPlatform] = useState<Platform>('android');
  const [newUnitId, setNewUnitId] = useState('');

  // Editable local state for the selected app's adConfig
  const [localAdmobEnabled, setLocalAdmobEnabled] = useState(true);
  const [localAdmobAppId, setLocalAdmobAppId] = useState('');
  const [localAdmobUnits, setLocalAdmobUnits] = useState<AdUnit[]>([]);

  const [localMetaEnabled, setLocalMetaEnabled] = useState(true);
  const [localMetaAppId, setLocalMetaAppId] = useState('');
  const [localMetaPlacements, setLocalMetaPlacements] = useState<AdPlacement[]>([]);

  const [localApplovinEnabled, setLocalApplovinEnabled] = useState(true);
  const [localApplovinSdkKey, setLocalApplovinSdkKey] = useState('');
  const [localApplovinUnits, setLocalApplovinUnits] = useState<AdUnit[]>([]);

  const [localWapadsEnabled, setLocalWapadsEnabled] = useState(true);
  const [localWapadsAppKey, setLocalWapadsAppKey] = useState('');

  const [waterfallPriority, setWaterfallPriority] = useState<AdNetworkType[]>([
    'admob',
    'meta',
    'applovin',
    'wapads',
  ]);

  const { user, hasRole } = useAuth();

  useEffect(() => {
    const unsub = subscribeApps(
      (loadedApps) => {
        setApps(loadedApps);
        if (loadedApps.length > 0 && !selectedAppId) {
          setSelectedAppId(loadedApps[0]?.id || '');
        }
      },
      () => setViewState('error'),
    );
    return () => unsub();
  }, [selectedAppId]);

  const selectedApp = apps.find((a) => a.id === selectedAppId);

  // Sync local edit state when selectedApp changes
  useEffect(() => {
    if (!selectedApp) return;

    const adCfg = selectedApp.adConfig;
    setLocalAdmobEnabled(adCfg?.admob?.enabled ?? true);
    setLocalAdmobAppId(adCfg?.admob?.appId ?? '');
    setLocalAdmobUnits(adCfg?.admob?.adUnits ? [...adCfg.admob.adUnits] : []);

    setLocalMetaEnabled(adCfg?.meta?.enabled ?? true);
    setLocalMetaAppId(adCfg?.meta?.appId ?? '');
    setLocalMetaPlacements(adCfg?.meta?.placements ? [...adCfg.meta.placements] : []);

    setLocalApplovinEnabled(adCfg?.applovin?.enabled ?? true);
    setLocalApplovinSdkKey(adCfg?.applovin?.sdkKey ?? '');
    setLocalApplovinUnits(adCfg?.applovin?.adUnits ? [...adCfg.applovin.adUnits] : []);

    setLocalWapadsEnabled(adCfg?.wapads?.enabled ?? true);
    setLocalWapadsAppKey(adCfg?.wapads?.appKey ?? `wap_key_${selectedApp.packageId}`);

    if (adCfg?.mediationPriority && adCfg.mediationPriority.length > 0) {
      setWaterfallPriority([...adCfg.mediationPriority]);
    } else {
      setWaterfallPriority(['admob', 'meta', 'applovin', 'wapads']);
    }
    setSaveSuccess(false);
  }, [selectedAppId, selectedApp]);

  // Waterfall reordering handlers
  const movePriorityUp = (index: number) => {
    if (index === 0) return;
    const next = [...waterfallPriority];
    const temp = next[index - 1]!;
    next[index - 1] = next[index]!;
    next[index] = temp;
    setWaterfallPriority(next);
  };

  const movePriorityDown = (index: number) => {
    if (index >= waterfallPriority.length - 1) return;
    const next = [...waterfallPriority];
    const temp = next[index + 1]!;
    next[index + 1] = next[index]!;
    next[index] = temp;
    setWaterfallPriority(next);
  };

  const handleSaveAdConfig = async () => {
    if (!selectedApp) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const actor = {
        uid: user?.uid || 'usr_admin',
        email: user?.email || 'admin@webappypie.com',
      };

      const updatedAdConfig = {
        admob: {
          appId: localAdmobAppId.trim() || 'ca-app-pub-3940256099942544~3347511713',
          adUnits: localAdmobUnits,
          enabled: localAdmobEnabled,
        },
        meta: {
          appId: localMetaAppId.trim() || '102938475610293',
          placements: localMetaPlacements,
          enabled: localMetaEnabled,
        },
        applovin: {
          sdkKey: localApplovinSdkKey.trim() || 'applovin_sdk_key_placeholder',
          adUnits: localApplovinUnits,
          enabled: localApplovinEnabled,
        },
        wapads: {
          appKey: localWapadsAppKey.trim() || `wap_key_${selectedApp.packageId}`,
          enabled: localWapadsEnabled,
        },
        mediationPriority: waterfallPriority,
      };

      await updateApp(selectedApp.id, { adConfig: updatedAdConfig }, actor);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to save ad configuration:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddUnitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim() || !newUnitId.trim()) return;

    if (newUnitNetwork === 'meta') {
      const newPlacement: AdPlacement = {
        id: `place_${Date.now()}`,
        name: newUnitName.trim(),
        type: newUnitType,
        placementId: newUnitId.trim(),
      };
      setLocalMetaPlacements((prev) => [...prev, newPlacement]);
    } else if (newUnitNetwork === 'admob') {
      const unit: AdUnit = {
        id: `unit_${Date.now()}`,
        name: newUnitName.trim(),
        type: newUnitType,
        platform: newUnitPlatform,
        adUnitId: newUnitId.trim(),
      };
      setLocalAdmobUnits((prev) => [...prev, unit]);
    } else {
      const unit: AdUnit = {
        id: `unit_${Date.now()}`,
        name: newUnitName.trim(),
        type: newUnitType,
        platform: newUnitPlatform,
        adUnitId: newUnitId.trim(),
      };
      setLocalApplovinUnits((prev) => [...prev, unit]);
    }

    setNewUnitName('');
    setNewUnitId('');
    setIsAddModalOpen(false);
  };

  const removeAdmobUnit = (id: string) => {
    setLocalAdmobUnits((prev) => prev.filter((u) => u.id !== id));
  };

  const removeMetaPlacement = (id: string) => {
    setLocalMetaPlacements((prev) => prev.filter((p) => p.id !== id));
  };

  const removeApplovinUnit = (id: string) => {
    setLocalApplovinUnits((prev) => prev.filter((u) => u.id !== id));
  };

  const adNetworks = [
    {
      id: 'admob' as AdNetworkType,
      name: 'Google AdMob',
      type: 'External Ad Network',
      formats: ['Banner', 'Interstitial', 'Rewarded', 'Native'],
      status: 'Active Provider',
      publicCred: 'AdMob App ID (Client Config)',
      privateCred: 'AdMob Reporting API (Secret Manager)',
      description: 'Primary Google mobile ad inventory with adaptive banners and rewarded video.',
    },
    {
      id: 'meta' as AdNetworkType,
      name: 'Meta Audience Network',
      type: 'External Ad Network',
      formats: ['Banner', 'Interstitial', 'Rewarded'],
      status: 'Active Provider',
      publicCred: 'Meta App ID (Client Config)',
      privateCred: 'System User Token (Secret Manager)',
      description:
        'High-performing social demand and bidding inventory from Meta Audience Network.',
    },
    {
      id: 'applovin' as AdNetworkType,
      name: 'AppLovin MAX',
      type: 'Mediation Platform',
      formats: ['Bidding Mediation', 'Waterfall', 'AdMob/Meta Adapter'],
      status: 'Active Mediation',
      publicCred: 'AppLovin SDK Key (Client Config)',
      privateCred: 'MAX Reporting API Key (Secret Manager)',
      description: 'Primary mediation platform dynamically orchestrating real-time ad auctions.',
    },
    {
      id: 'wapads' as AdNetworkType,
      name: 'WAPAds (Own Promotion)',
      type: 'First-Party Network',
      formats: ['Banner', 'Interstitial', 'Native House Ads'],
      status: 'Enabled (Zero Ad Spend)',
      publicCred: 'App Key (Client Config)',
      privateCred: 'HMAC Signing Secret (Secret Manager)',
      description:
        'First-party cross-app promotion network delivering house ads when fill is low or user retention is prioritized.',
    },
  ];

  const getNetworkTitle = (net: AdNetworkType) => {
    switch (net) {
      case 'admob':
        return 'Google AdMob';
      case 'meta':
        return 'Meta Audience Network';
      case 'applovin':
        return 'AppLovin MAX';
      case 'wapads':
        return 'WAPAds (First-Party)';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ad Networks & Mediation"
        description="Configure Google AdMob, Meta Audience Network, AppLovin MAX, and first-party WAPAds"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 text-xs dark:border-slate-800 dark:bg-slate-900">
              <button
                onClick={() => setActiveTab('waterfall')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  activeTab === 'waterfall'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                App Ad Units & Waterfall
              </button>
              <button
                onClick={() => setActiveTab('registry')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  activeTab === 'registry'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                Provider Registry
              </button>
            </div>
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 text-xs dark:border-slate-800 dark:bg-slate-900">
              {(['content', 'loading', 'empty', 'error'] as ViewState[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setViewState(s)}
                  className={`rounded px-2 py-1 capitalize transition-colors ${
                    viewState === s
                      ? 'bg-indigo-600 font-semibold text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {viewState === 'loading' && (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {viewState === 'empty' && (
        <EmptyState
          title="No ad networks configured"
          description="Configure AdMob, Meta, or AppLovin MAX ad units to begin monetizing mobile apps."
          icon={<Megaphone className="h-6 w-6" />}
          actionLabel="Configure Network"
          onAction={() => setViewState('content')}
        />
      )}

      {viewState === 'error' && (
        <ErrorState
          title="Failed to load ad network configurations"
          message="Could not load ad configurations."
          onRetry={() => setViewState('content')}
        />
      )}

      {viewState === 'content' && activeTab === 'registry' && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {adNetworks.map((net) => (
              <Card key={net.name} className="flex flex-col justify-between">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{net.name}</CardTitle>
                      <span className="text-xs text-slate-500">{net.type}</span>
                    </div>
                    <Badge variant="success" className="text-[10px]">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> {net.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {net.description}
                  </p>
                  <div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Supported Formats:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {net.formats.map((f) => (
                        <span
                          key={f}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Smartphone className="h-3.5 w-3.5 text-indigo-500" />
                      <span className="font-medium">Public Client Config:</span> {net.publicCred}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="font-medium">Backend Credentials:</span> {net.privateCred}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {viewState === 'content' && activeTab === 'waterfall' && (
        <div className="space-y-6">
          {/* App Selector and Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <label
                htmlFor="app-select"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Target Mobile App:
              </label>
              <select
                id="app-select"
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.platform} — {a.packageId})
                  </option>
                ))}
              </select>
              {selectedApp && (
                <Badge variant="outline" className="text-[10px]">
                  {selectedApp.platform.toUpperCase()}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Ad config saved to Firestore!
                </span>
              )}
              {hasRole('editor') && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setIsAddModalOpen(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Ad Unit
                  </Button>
                  <Button size="sm" onClick={handleSaveAdConfig} disabled={isSaving}>
                    {isSaving ? (
                      <Spinner size="sm" className="mr-1.5" />
                    ) : (
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Save Waterfall
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Mediation Waterfall Priority */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-500" /> Mediation Waterfall Priority
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Orders ad network request execution on mobile clients. If primary fails or has
                    no fill, the SDK waterfalls to the next provider, concluding with first-party
                    WAPAds house ads.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {waterfallPriority.map((networkId, idx) => (
                  <div
                    key={networkId}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700 text-[11px] dark:bg-indigo-900/50 dark:text-indigo-300">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {getNetworkTitle(networkId)}
                      </span>
                      {networkId === 'wapads' && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-amber-600 border-amber-300"
                        >
                          Guaranteed Fallback
                        </Badge>
                      )}
                    </div>
                    {hasRole('editor') && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => movePriorityUp(idx)}
                          disabled={idx === 0}
                          aria-label={`Move ${getNetworkTitle(networkId)} priority up`}
                          className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => movePriorityDown(idx)}
                          disabled={idx === waterfallPriority.length - 1}
                          aria-label={`Move ${getNetworkTitle(networkId)} priority down`}
                          className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Network Client Credentials / IDs */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Google AdMob Config</CardTitle>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={localAdmobEnabled}
                      onChange={(e) => setLocalAdmobEnabled(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    Enabled
                  </label>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label
                    htmlFor="admob-app-id"
                    className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1"
                  >
                    AdMob App ID:
                  </label>
                  <input
                    id="admob-app-id"
                    type="text"
                    value={localAdmobAppId}
                    onChange={(e) => setLocalAdmobAppId(e.target.value)}
                    placeholder="ca-app-pub-3940256099942544~3347511713"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Meta Audience Network Config</CardTitle>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={localMetaEnabled}
                      onChange={(e) => setLocalMetaEnabled(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    Enabled
                  </label>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label
                    htmlFor="meta-app-id"
                    className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1"
                  >
                    Meta App ID:
                  </label>
                  <input
                    id="meta-app-id"
                    type="text"
                    value={localMetaAppId}
                    onChange={(e) => setLocalMetaAppId(e.target.value)}
                    placeholder="102938475610293"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">AppLovin MAX Config</CardTitle>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={localApplovinEnabled}
                      onChange={(e) => setLocalApplovinEnabled(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    Enabled
                  </label>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label
                    htmlFor="applovin-sdk-key"
                    className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1"
                  >
                    AppLovin SDK Key:
                  </label>
                  <input
                    id="applovin-sdk-key"
                    type="text"
                    value={localApplovinSdkKey}
                    onChange={(e) => setLocalApplovinSdkKey(e.target.value)}
                    placeholder="applovin_sdk_key_live_..."
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">WAPAds House Ads Config</CardTitle>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={localWapadsEnabled}
                      onChange={(e) => setLocalWapadsEnabled(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    Enabled
                  </label>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label
                    htmlFor="wapads-app-key"
                    className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1"
                  >
                    WAPAds App Key (Promotion API):
                  </label>
                  <input
                    id="wapads-app-key"
                    type="text"
                    value={localWapadsAppKey}
                    onChange={(e) => setLocalWapadsAppKey(e.target.value)}
                    placeholder="wap_key_..."
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ad Units & Placements Inventory */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Ad Units & Placements Inventory</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Individual unit IDs delivered to the mobile app for banner, interstitial,
                    rewarded, and native placements.
                  </p>
                </div>
                {hasRole('editor') && (
                  <Button size="sm" variant="outline" onClick={() => setIsAddModalOpen(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Unit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Unit / Placement ID</TableHead>
                    {hasRole('editor') && <TableHead className="w-16 text-right">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localAdmobUnits.length === 0 &&
                    localMetaPlacements.length === 0 &&
                    localApplovinUnits.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-slate-500 text-xs">
                          No ad units configured for this app yet. Click "Add Ad Unit" to create
                          one.
                        </TableCell>
                      </TableRow>
                    )}

                  {localAdmobUnits.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold text-slate-700 dark:text-slate-300">
                        <Badge variant="outline" className="text-[10px]">
                          AdMob
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>
                        <span className="capitalize">{u.type}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {u.platform.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                        {u.adUnitId}
                      </TableCell>
                      {hasRole('editor') && (
                        <TableCell className="text-right">
                          <button
                            onClick={() => removeAdmobUnit(u.id)}
                            aria-label={`Delete AdMob unit ${u.name}`}
                            className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}

                  {localMetaPlacements.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-semibold text-slate-700 dark:text-slate-300">
                        <Badge
                          variant="outline"
                          className="text-[10px] text-blue-600 border-blue-300"
                        >
                          Meta
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <span className="capitalize">{p.type}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          ALL
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                        {p.placementId}
                      </TableCell>
                      {hasRole('editor') && (
                        <TableCell className="text-right">
                          <button
                            onClick={() => removeMetaPlacement(p.id)}
                            aria-label={`Delete Meta placement ${p.name}`}
                            className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}

                  {localApplovinUnits.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold text-slate-700 dark:text-slate-300">
                        <Badge
                          variant="outline"
                          className="text-[10px] text-purple-600 border-purple-300"
                        >
                          AppLovin MAX
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>
                        <span className="capitalize">{u.type}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {u.platform.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                        {u.adUnitId}
                      </TableCell>
                      {hasRole('editor') && (
                        <TableCell className="text-right">
                          <button
                            onClick={() => removeApplovinUnit(u.id)}
                            aria-label={`Delete AppLovin unit ${u.name}`}
                            className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Ad Unit Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Ad Unit / Placement"
      >
        <form onSubmit={handleAddUnitSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Provider Network
            </label>
            <select
              value={newUnitNetwork}
              onChange={(e) => setNewUnitNetwork(e.target.value as any)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="admob">Google AdMob</option>
              <option value="meta">Meta Audience Network</option>
              <option value="applovin">AppLovin MAX</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Unit Name / Placement Label
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Home Sticky Banner"
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Ad Format
              </label>
              <select
                value={newUnitType}
                onChange={(e) => setNewUnitType(e.target.value as AdUnitType)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="banner">Banner</option>
                <option value="interstitial">Interstitial</option>
                <option value="rewarded">Rewarded</option>
                <option value="native">Native</option>
                <option value="rewarded_interstitial">Rewarded Interstitial</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Target Platform
              </label>
              <select
                value={newUnitPlatform}
                onChange={(e) => setNewUnitPlatform(e.target.value as Platform)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="android">Android</option>
                <option value="ios">iOS</option>
                <option value="web">Web</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Ad Unit ID / Placement ID
            </label>
            <input
              type="text"
              required
              placeholder="e.g. ca-app-pub-3940256099942544/6300978111"
              value={newUnitId}
              onChange={(e) => setNewUnitId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Add Ad Unit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
