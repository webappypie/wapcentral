import React, { useState, useEffect } from 'react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Spinner,
  ErrorState,
} from '@wapcentral/ui';
import {
  Megaphone,
  Smartphone,
  Save,
  CheckCircle2,
  AlertTriangle,
  Power,
  ShieldAlert,
  Layers,
  Check,
  Copy,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { RoleGuard } from '../components/RoleGuard.js';
import type {
  App,
  AppSimpleAdsConfig,
  AdEnvironment,
  AdStrategy,
  DemandSourceId,
  AdKillSwitches,
} from '@wapcentral/types';
import { subscribeApps, updateAppAdsConfig } from '../services/appsService.js';
import { subscribeAdKillSwitches, updateAdKillSwitches } from '../services/adsService.js';
import { ADMOB_OFFICIAL_TEST_IDS } from '@wapcentral/config';

export const AdsPage: React.FC = () => {
  const { user, hasRole } = useAuth();

  // Apps state
  const [apps, setApps] = useState<App[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Kill switches state
  const [killSwitches, setKillSwitches] = useState<AdKillSwitches | null>(null);

  // Form State for Selected App
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [adsEnvironment, setAdsEnvironment] = useState<AdEnvironment>('testing');
  const [adStrategy, setAdStrategy] = useState<AdStrategy>('automatic');
  const [singleSourceNetwork, setSingleSourceNetwork] = useState<DemandSourceId>('applovin');
  const [bundledAdapters, setBundledAdapters] = useState<Record<DemandSourceId, boolean>>({
    applovin: true,
    admob: true,
    meta: true,
    inmobi: true,
    unity: true,
    wapCustomAds: false,
  });

  // Formats
  const [fmtBanner, setFmtBanner] = useState(true);
  const [fmtNative, setFmtNative] = useState(true);
  const [fmtInterstitial, setFmtInterstitial] = useState(true);
  const [fmtRewarded, setFmtRewarded] = useState(true);
  const [fmtAppOpen, setFmtAppOpen] = useState(true);
  const [fmtRewardedInterstitial, setFmtRewardedInterstitial] = useState(false);

  // Demand Sources
  const [netApplovin, setNetApplovin] = useState(true);
  const [netAdmob, setNetAdmob] = useState(true);
  const [netMeta, setNetMeta] = useState(false);
  const [netInmobi, setNetInmobi] = useState(false);
  const [netUnity, setNetUnity] = useState(false);

  // Production IDs
  const [applovinAppId, setApplovinAppId] = useState('');
  const [applovinBannerId, setApplovinBannerId] = useState('');
  const [applovinNativeId, setApplovinNativeId] = useState('');
  const [applovinInterstitialId, setApplovinInterstitialId] = useState('');
  const [applovinRewardedId, setApplovinRewardedId] = useState('');
  const [applovinAppOpenId, setApplovinAppOpenId] = useState('');
  const [applovinRewardedInterstitialId, setApplovinRewardedInterstitialId] = useState('');

  const [admobAppId, setAdmobAppId] = useState('');
  const [admobBannerId, setAdmobBannerId] = useState('');
  const [admobNativeId, setAdmobNativeId] = useState('');
  const [admobInterstitialId, setAdmobInterstitialId] = useState('');
  const [admobRewardedId, setAdmobRewardedId] = useState('');
  const [admobAppOpenId, setAdmobAppOpenId] = useState('');
  const [admobRewardedInterstitialId, setAdmobRewardedInterstitialId] = useState('');

  const [metaBannerId, setMetaBannerId] = useState('');
  const [metaNativeId, setMetaNativeId] = useState('');
  const [metaInterstitialId, setMetaInterstitialId] = useState('');
  const [metaRewardedId, setMetaRewardedId] = useState('');

  const [inmobiAccountId, setInmobiAccountId] = useState('');
  const [inmobiBannerId, setInmobiBannerId] = useState('');
  const [inmobiNativeId, setInmobiNativeId] = useState('');
  const [inmobiInterstitialId, setInmobiInterstitialId] = useState('');
  const [inmobiRewardedId, setInmobiRewardedId] = useState('');

  const [unityGameId, setUnityGameId] = useState('');
  const [unityBannerId, setUnityBannerId] = useState('');
  const [unityInterstitialId, setUnityInterstitialId] = useState('');
  const [unityRewardedId, setUnityRewardedId] = useState('');

  // Developer Testing Accordion
  const [showTestIds, setShowTestIds] = useState(false);
  const [copiedTestId, setCopiedTestId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubApps = subscribeApps(
      (loadedApps) => {
        setApps(loadedApps);
        if (loadedApps.length > 0 && !selectedAppId) {
          setSelectedAppId(loadedApps[0]!.id);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    const unsubSwitches = subscribeAdKillSwitches((sw) => {
      setKillSwitches(sw);
    });

    return () => {
      unsubApps();
      unsubSwitches();
    };
  }, []);

  // When selectedAppId changes, load configuration
  useEffect(() => {
    if (!selectedAppId) return;
    const currentApp = apps.find((a) => a.id === selectedAppId);
    if (!currentApp) return;

    const adsCfg = currentApp.simpleAdsConfig;
    if (adsCfg) {
      setAdsEnabled(Boolean(adsCfg.adsEnabled));
      setAdsEnvironment(adsCfg.environment || 'testing');
      setAdStrategy(adsCfg.strategy || 'automatic');
      setSingleSourceNetwork(adsCfg.singleSourceNetwork || 'applovin');
      if (adsCfg.bundledAdapters) {
        setBundledAdapters({
          applovin: adsCfg.bundledAdapters.applovin ?? true,
          admob: adsCfg.bundledAdapters.admob ?? true,
          meta: adsCfg.bundledAdapters.meta ?? true,
          inmobi: adsCfg.bundledAdapters.inmobi ?? true,
          unity: adsCfg.bundledAdapters.unity ?? true,
          wapCustomAds: false,
        });
      }
      setFmtBanner(adsCfg.enabledFormats?.banner ?? true);
      setFmtNative(adsCfg.enabledFormats?.native ?? true);
      setFmtInterstitial(adsCfg.enabledFormats?.interstitial ?? true);
      setFmtRewarded(adsCfg.enabledFormats?.rewarded ?? true);
      setFmtAppOpen(adsCfg.enabledFormats?.appOpen ?? true);
      setFmtRewardedInterstitial(adsCfg.enabledFormats?.rewardedInterstitial ?? false);

      setNetApplovin(adsCfg.networks?.applovin ?? true);
      setNetAdmob(adsCfg.networks?.admob ?? true);
      setNetMeta(adsCfg.networks?.meta ?? false);
      setNetInmobi(adsCfg.networks?.inmobi ?? false);
      setNetUnity(adsCfg.networks?.unity ?? false);

      const netCfg = adsCfg.networkConfig;
      if (netCfg) {
        setApplovinAppId(netCfg.applovin?.appId || '');
        setApplovinBannerId(netCfg.applovin?.placementIds?.['banner'] || '');
        setApplovinNativeId(netCfg.applovin?.placementIds?.['native'] || '');
        setApplovinInterstitialId(netCfg.applovin?.placementIds?.['interstitial'] || '');
        setApplovinRewardedId(netCfg.applovin?.placementIds?.['rewarded'] || '');
        setApplovinAppOpenId(netCfg.applovin?.placementIds?.['app_open'] || '');
        setApplovinRewardedInterstitialId(netCfg.applovin?.placementIds?.['rewarded_interstitial'] || '');

        setAdmobAppId(netCfg.admob?.appId || '');
        setAdmobBannerId(netCfg.admob?.bannerId || '');
        setAdmobNativeId(netCfg.admob?.nativeId || '');
        setAdmobInterstitialId(netCfg.admob?.interstitialId || '');
        setAdmobRewardedId(netCfg.admob?.rewardedId || '');
        setAdmobAppOpenId(netCfg.admob?.appOpenId || '');
        setAdmobRewardedInterstitialId(netCfg.admob?.rewardedInterstitialId || '');

        setMetaBannerId(netCfg.meta?.placementIds?.['banner'] || '');
        setMetaNativeId(netCfg.meta?.placementIds?.['native'] || '');
        setMetaInterstitialId(netCfg.meta?.placementIds?.['interstitial'] || '');
        setMetaRewardedId(netCfg.meta?.placementIds?.['rewarded'] || '');

        setInmobiAccountId(netCfg.inmobi?.accountId || '');
        setInmobiBannerId(netCfg.inmobi?.placementIds?.['banner'] || '');
        setInmobiNativeId(netCfg.inmobi?.placementIds?.['native'] || '');
        setInmobiInterstitialId(netCfg.inmobi?.placementIds?.['interstitial'] || '');
        setInmobiRewardedId(netCfg.inmobi?.placementIds?.['rewarded'] || '');

        setUnityGameId(netCfg.unity?.gameId || '');
        setUnityBannerId(netCfg.unity?.placementIds?.['banner'] || '');
        setUnityInterstitialId(netCfg.unity?.placementIds?.['interstitial'] || '');
        setUnityRewardedId(netCfg.unity?.placementIds?.['rewarded'] || '');
      }
    } else {
      // Default initial state
      setAdsEnabled(false);
      setAdsEnvironment('testing');
      setAdStrategy('automatic');
      setSingleSourceNetwork('applovin');
      setNetApplovin(true);
      setNetAdmob(true);
      setNetMeta(false);
      setNetInmobi(false);
      setNetUnity(false);
    }
  }, [selectedAppId, apps]);

  const selectedApp = apps.find((a) => a.id === selectedAppId);

  const handleCopyTestId = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTestId(text);
    setTimeout(() => setCopiedTestId(null), 2000);
  };

  const handleToggleGlobalKill = async () => {
    if (!killSwitches) return;
    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };
    try {
      await updateAdKillSwitches(
        {
          globalAdsDisabled: !killSwitches.globalAdsDisabled,
          reason: 'Toggled via Ads Control Plane',
        },
        actor,
      );
      setFeedbackSuccess(
        killSwitches.globalAdsDisabled
          ? 'Global ads kill switch deactivated. Ads operational.'
          : 'Global ads kill switch ACTIVATED. All third-party ads suppressed.',
      );
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to toggle kill switch.');
    }
  };

  const handleToggleAppKill = async () => {
    if (!killSwitches || !selectedApp) return;
    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };
    const currentAppKilled = Boolean(killSwitches.apps?.[selectedApp.id]);
    try {
      await updateAdKillSwitches(
        {
          apps: {
            ...killSwitches.apps,
            [selectedApp.id]: !currentAppKilled,
          },
        },
        actor,
      );
      setFeedbackSuccess(
        currentAppKilled
          ? `Ad kill switch deactivated for ${selectedApp.name}.`
          : `Ad kill switch ACTIVATED for ${selectedApp.name}. Ads suppressed for this app.`,
      );
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to toggle app kill switch.');
    }
  };

  const handleSaveAdsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    setSaving(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);

    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };

    const newAdsConfig: AppSimpleAdsConfig = {
      adsEnabled,
      environment: adsEnvironment,
      strategy: adStrategy,
      ...(adStrategy === 'single_source' ? { singleSourceNetwork } : {}),
      bundledAdapters,
      enabledFormats: {
        banner: fmtBanner,
        native: fmtNative,
        interstitial: fmtInterstitial,
        rewarded: fmtRewarded,
        appOpen: fmtAppOpen,
        rewardedInterstitial: fmtRewardedInterstitial,
      },
      networks: {
        applovin: netApplovin,
        admob: netAdmob,
        meta: netMeta,
        inmobi: netInmobi,
        unity: netUnity,
        wapCustomAds: false,
      },
      networkConfig: {
        enabled: true,
        applovin: {
          ...(applovinAppId.trim() ? { appId: applovinAppId.trim() } : {}),
          placementIds: {
            ...(applovinBannerId.trim() ? { banner: applovinBannerId.trim() } : {}),
            ...(applovinNativeId.trim() ? { native: applovinNativeId.trim() } : {}),
            ...(applovinInterstitialId.trim() ? { interstitial: applovinInterstitialId.trim() } : {}),
            ...(applovinRewardedId.trim() ? { rewarded: applovinRewardedId.trim() } : {}),
            ...(applovinAppOpenId.trim() ? { app_open: applovinAppOpenId.trim() } : {}),
            ...(applovinRewardedInterstitialId.trim() ? { rewarded_interstitial: applovinRewardedInterstitialId.trim() } : {}),
          },
        },
        admob: {
          ...(admobAppId.trim() ? { appId: admobAppId.trim() } : {}),
          ...(admobBannerId.trim() ? { bannerId: admobBannerId.trim() } : {}),
          ...(admobNativeId.trim() ? { nativeId: admobNativeId.trim() } : {}),
          ...(admobInterstitialId.trim() ? { interstitialId: admobInterstitialId.trim() } : {}),
          ...(admobRewardedId.trim() ? { rewardedId: admobRewardedId.trim() } : {}),
          ...(admobAppOpenId.trim() ? { appOpenId: admobAppOpenId.trim() } : {}),
          ...(admobRewardedInterstitialId.trim() ? { rewardedInterstitialId: admobRewardedInterstitialId.trim() } : {}),
        },
        meta: {
          placementIds: {
            ...(metaBannerId.trim() ? { banner: metaBannerId.trim() } : {}),
            ...(metaNativeId.trim() ? { native: metaNativeId.trim() } : {}),
            ...(metaInterstitialId.trim() ? { interstitial: metaInterstitialId.trim() } : {}),
            ...(metaRewardedId.trim() ? { rewarded: metaRewardedId.trim() } : {}),
          },
        },
        inmobi: {
          ...(inmobiAccountId.trim() ? { accountId: inmobiAccountId.trim() } : {}),
          placementIds: {
            ...(inmobiBannerId.trim() ? { banner: inmobiBannerId.trim() } : {}),
            ...(inmobiNativeId.trim() ? { native: inmobiNativeId.trim() } : {}),
            ...(inmobiInterstitialId.trim() ? { interstitial: inmobiInterstitialId.trim() } : {}),
            ...(inmobiRewardedId.trim() ? { rewarded: inmobiRewardedId.trim() } : {}),
          },
        },
        unity: {
          ...(unityGameId.trim() ? { gameId: unityGameId.trim() } : {}),
          placementIds: {
            ...(unityBannerId.trim() ? { banner: unityBannerId.trim() } : {}),
            ...(unityInterstitialId.trim() ? { interstitial: unityInterstitialId.trim() } : {}),
            ...(unityRewardedId.trim() ? { rewarded: unityRewardedId.trim() } : {}),
          },
        },
        wapCustomAds: {
          campaignEnabled: false,
        },
      },
    };

    try {
      await updateAppAdsConfig(selectedApp.id, newAdsConfig, actor);
      setFeedbackSuccess(`Monetization configuration for ${selectedApp.name} saved successfully.`);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to update ads configuration.');
    } finally {
      setSaving(false);
    }
  };

  const isGlobalKilled = Boolean(killSwitches?.globalAdsDisabled);
  const isAppKilled = Boolean(selectedApp && killSwitches?.apps?.[selectedApp.id]);

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center space-y-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading Ads &amp; Monetization Control Plane...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState
          title="Failed to Load Ads"
          message={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <RoleGuard requiredRole="viewer">
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Ads &amp; Monetization"
          description="App-centric third-party ad mediation via AppLovin MAX, demand source routing, and emergency kill switches."
          actions={
            <div className="flex items-center gap-2">
              {isGlobalKilled ? (
                <Badge variant="destructive" className="font-mono text-xs">
                  <ShieldAlert className="h-3 w-3 mr-1" />
                  GLOBAL ADS HALTED
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-mono text-xs">
                  PLATFORM ADS ACTIVE
                </Badge>
              )}
            </div>
          }
        />

        {/* Global Alerts */}
        {feedbackSuccess && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{feedbackSuccess}</span>
            </div>
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

        {/* STEP 1: APP SELECTOR BAR */}
        <Card className="border-indigo-200 dark:border-indigo-900 bg-gradient-to-r from-indigo-50/70 via-white to-slate-50 dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Step 1: Select Application
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Choose an app to configure its monetization rules, mediation strategy, and production ad units.
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-80">
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {apps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.packageId}) — [{a.platform.toUpperCase()}]
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedApp && (
          <form onSubmit={handleSaveAdsConfig} className="space-y-6">
            {/* STEP 2: APP STATUS & CORE TOGGLES */}
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold">
                      Monetization Status &amp; Environment: {selectedApp.name}
                    </CardTitle>
                    <Badge variant={selectedApp.platform === 'android' ? 'success' : 'default'} className="uppercase text-[10px]">
                      {selectedApp.platform}
                    </Badge>
                  </div>

                  {/* Kill Switch status */}
                  <div className="flex items-center gap-2">
                    {isAppKilled && (
                      <Badge variant="destructive" className="text-[10px]">
                        App Kill Switch Engaged
                      </Badge>
                    )}
                    {hasRole('editor') && (
                      <Button
                        type="button"
                        variant={isAppKilled ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={handleToggleAppKill}
                        className="text-xs h-7 px-2"
                      >
                        <Power className="h-3 w-3 mr-1" />
                        {isAppKilled ? 'Deactivate App Kill' : 'App Kill Switch'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Master Toggle */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                        Master Ads Switch
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Controls whether third-party ads are initialized and rendered inside {selectedApp.name}.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdsEnabled(!adsEnabled)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        adsEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          adsEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Environment Switch */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                        Environment Mode
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Testing returns official sample ad units. Production requires live placement IDs.
                      </p>
                    </div>
                    <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 p-1 bg-white dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => setAdsEnvironment('testing')}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                          adsEnvironment === 'testing'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        Testing
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdsEnvironment('production')}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                          adsEnvironment === 'production'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        Production
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mediation Architecture */}
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 p-4 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Mediation Strategy: AppLovin MAX
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        AppLovin MAX acts as the single mediation layer. Demand partners (AdMob, Meta, InMobi, Unity) are mediated through MAX adapters.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={adStrategy}
                        onChange={(e) => setAdStrategy(e.target.value as AdStrategy)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
                      >
                        <option value="automatic">MAX Automatic Mediation</option>
                        <option value="single_source">Single Demand Source (via MAX)</option>
                      </select>
                    </div>
                  </div>

                  {adStrategy === 'single_source' && (
                    <div className="flex items-center gap-3 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Sole Active Source:
                      </span>
                      <select
                        value={singleSourceNetwork}
                        onChange={(e) => setSingleSourceNetwork(e.target.value as DemandSourceId)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-xs"
                      >
                        <option value="applovin">AppLovin Demand</option>
                        <option value="admob">Google AdMob</option>
                        <option value="meta">Meta Audience Network</option>
                        <option value="inmobi">InMobi</option>
                        <option value="unity">Unity Ads</option>
                      </select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* STEP 3: SUPPORTED AD FORMATS */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Supported Ad Formats</CardTitle>
                <p className="text-xs text-slate-500">Toggle formats permitted to load inside this application.</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { id: 'banner', label: 'Banner', checked: fmtBanner, set: setFmtBanner },
                    { id: 'native', label: 'Native Ad', checked: fmtNative, set: setFmtNative },
                    { id: 'interstitial', label: 'Interstitial', checked: fmtInterstitial, set: setFmtInterstitial },
                    { id: 'rewarded', label: 'Rewarded', checked: fmtRewarded, set: setFmtRewarded },
                    { id: 'appOpen', label: 'App Open', checked: fmtAppOpen, set: setFmtAppOpen },
                    { id: 'rewardedInterstitial', label: 'Rewarded Interstitial', checked: fmtRewardedInterstitial, set: setFmtRewardedInterstitial },
                  ].map((fmt) => (
                    <label
                      key={fmt.id}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-colors text-center ${
                        fmt.checked
                          ? 'border-indigo-600 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/30 text-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={fmt.checked}
                        onChange={(e) => fmt.set(e.target.checked)}
                        className="sr-only"
                      />
                      <span className="text-xs font-bold">{fmt.label}</span>
                      <span className={`text-[10px] mt-1 font-semibold ${fmt.checked ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                        {fmt.checked ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* STEP 4: DEMAND SOURCES & PRODUCTION CONFIG */}
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-bold">Demand Sources &amp; Production Ad Units</CardTitle>
                <p className="text-xs text-slate-500">
                  Configure real provider account and placement IDs. When Environment is set to Production, these live IDs are returned to the client SDK.
                </p>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                {/* 1. AppLovin MAX */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">AppLovin MAX</span>
                      <Badge variant="outline" className="text-[10px] font-mono">Core Mediator</Badge>
                      <Badge variant={bundledAdapters.applovin ? 'success' : 'warning'} className="text-[10px]">
                        {bundledAdapters.applovin ? 'Adapter Bundled' : 'Requires Adapter'}
                      </Badge>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={netApplovin}
                        onChange={(e) => setNetApplovin(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Active</span>
                    </label>
                  </div>

                  {netApplovin && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          AppLovin MAX SDK Key / App ID
                        </label>
                        <input
                          type="text"
                          value={applovinAppId}
                          onChange={(e) => setApplovinAppId(e.target.value)}
                          placeholder="e.g. your_max_sdk_key"
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          MAX Banner Ad Unit ID
                        </label>
                        <input
                          type="text"
                          value={applovinBannerId}
                          onChange={(e) => setApplovinBannerId(e.target.value)}
                          placeholder="e.g. 1a2b3c4d5e6f7g8h"
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          MAX Interstitial Ad Unit ID
                        </label>
                        <input
                          type="text"
                          value={applovinInterstitialId}
                          onChange={(e) => setApplovinInterstitialId(e.target.value)}
                          placeholder="e.g. 2b3c4d5e6f7g8h9i"
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          MAX Rewarded Ad Unit ID
                        </label>
                        <input
                          type="text"
                          value={applovinRewardedId}
                          onChange={(e) => setApplovinRewardedId(e.target.value)}
                          placeholder="e.g. 3c4d5e6f7g8h9i0j"
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          MAX Native Ad Unit ID
                        </label>
                        <input
                          type="text"
                          value={applovinNativeId}
                          onChange={(e) => setApplovinNativeId(e.target.value)}
                          placeholder="e.g. 4d5e6f7g8h9i0j1k"
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          MAX App Open Ad Unit ID
                        </label>
                        <input
                          type="text"
                          value={applovinAppOpenId}
                          onChange={(e) => setApplovinAppOpenId(e.target.value)}
                          placeholder="e.g. 5e6f7g8h9i0j1k2l"
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Google AdMob */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">Google AdMob</span>
                      <Badge variant="outline" className="text-[10px] font-mono">Bidding / Waterfall</Badge>
                      <Badge variant={bundledAdapters.admob ? 'success' : 'warning'} className="text-[10px]">
                        {bundledAdapters.admob ? 'Adapter Bundled' : 'Requires Adapter'}
                      </Badge>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={netAdmob}
                        onChange={(e) => setNetAdmob(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Active</span>
                    </label>
                  </div>

                  {netAdmob && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          AdMob App ID
                        </label>
                        <input
                          type="text"
                          value={admobAppId}
                          onChange={(e) => setAdmobAppId(e.target.value)}
                          placeholder="ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          AdMob Banner ID
                        </label>
                        <input
                          type="text"
                          value={admobBannerId}
                          onChange={(e) => setAdmobBannerId(e.target.value)}
                          placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          AdMob Interstitial ID
                        </label>
                        <input
                          type="text"
                          value={admobInterstitialId}
                          onChange={(e) => setAdmobInterstitialId(e.target.value)}
                          placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          AdMob Rewarded ID
                        </label>
                        <input
                          type="text"
                          value={admobRewardedId}
                          onChange={(e) => setAdmobRewardedId(e.target.value)}
                          placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          AdMob Native ID
                        </label>
                        <input
                          type="text"
                          value={admobNativeId}
                          onChange={(e) => setAdmobNativeId(e.target.value)}
                          placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          AdMob App Open ID
                        </label>
                        <input
                          type="text"
                          value={admobAppOpenId}
                          onChange={(e) => setAdmobAppOpenId(e.target.value)}
                          placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Meta Audience Network */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">Meta Audience Network</span>
                      <Badge variant="outline" className="text-[10px] font-mono">Bidding Demand</Badge>
                      <Badge variant={bundledAdapters.meta ? 'success' : 'warning'} className="text-[10px]">
                        {bundledAdapters.meta ? 'Adapter Bundled' : 'Requires Adapter'}
                      </Badge>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={netMeta}
                        onChange={(e) => setNetMeta(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Active</span>
                    </label>
                  </div>

                  {netMeta && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Meta Banner Placement ID
                        </label>
                        <input
                          type="text"
                          value={metaBannerId}
                          onChange={(e) => setMetaBannerId(e.target.value)}
                          placeholder="e.g. VID_HD_16_9_15S_APP_INSTALL#..."
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Meta Interstitial Placement ID
                        </label>
                        <input
                          type="text"
                          value={metaInterstitialId}
                          onChange={(e) => setMetaInterstitialId(e.target.value)}
                          placeholder="Placement ID"
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Meta Rewarded Placement ID
                        </label>
                        <input
                          type="text"
                          value={metaRewardedId}
                          onChange={(e) => setMetaRewardedId(e.target.value)}
                          placeholder="Placement ID"
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Meta Native Placement ID
                        </label>
                        <input
                          type="text"
                          value={metaNativeId}
                          onChange={(e) => setMetaNativeId(e.target.value)}
                          placeholder="Placement ID"
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. InMobi & Unity Ads */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* InMobi */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">InMobi</span>
                        <Badge variant={bundledAdapters.inmobi ? 'success' : 'warning'} className="text-[10px]">
                          {bundledAdapters.inmobi ? 'Bundled' : 'Optional'}
                        </Badge>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={netInmobi}
                          onChange={(e) => setNetInmobi(e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600"
                        />
                        <span>Active</span>
                      </label>
                    </div>

                    {netInmobi && (
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            InMobi Account ID
                          </label>
                          <input
                            type="text"
                            value={inmobiAccountId}
                            onChange={(e) => setInmobiAccountId(e.target.value)}
                            placeholder="Account ID"
                            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Banner Placement ID
                          </label>
                          <input
                            type="text"
                            value={inmobiBannerId}
                            onChange={(e) => setInmobiBannerId(e.target.value)}
                            placeholder="Placement ID"
                            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Unity Ads */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">Unity Ads</span>
                        <Badge variant={bundledAdapters.unity ? 'success' : 'warning'} className="text-[10px]">
                          {bundledAdapters.unity ? 'Bundled' : 'Optional'}
                        </Badge>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={netUnity}
                          onChange={(e) => setNetUnity(e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600"
                        />
                        <span>Active</span>
                      </label>
                    </div>

                    {netUnity && (
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Unity Game ID
                          </label>
                          <input
                            type="text"
                            value={unityGameId}
                            onChange={(e) => setUnityGameId(e.target.value)}
                            placeholder="Game ID (Android/iOS)"
                            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Interstitial Placement ID
                          </label>
                          <input
                            type="text"
                            value={unityInterstitialId}
                            onChange={(e) => setUnityInterstitialId(e.target.value)}
                            placeholder="Placement ID"
                            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* STEP 5: REQUIRED SDK / ADAPTER REMINDER */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/70 dark:bg-slate-900/60 flex items-start gap-3">
              <Info className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block">
                  SDK &amp; Adapter Installation Reminder:
                </span>
                <p>
                  Remote configuration cannot install missing native SDK binaries or adapters. Your Flutter application must declare the corresponding native mediation adapter packages (e.g. <code className="font-mono text-indigo-600 dark:text-indigo-300">applovin_max</code>, <code className="font-mono text-indigo-600 dark:text-indigo-300">google_mobile_ads</code>) in its build configuration for demand networks to load.
                </p>
              </div>
            </div>

            {/* QUICK TEST IDS ACCORDION */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTestIds(!showTestIds)}
                className="w-full p-4 flex items-center justify-between text-left text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850"
              >
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-mono text-[10px]">
                    TESTING
                  </span>
                  <span>Developer Reference: Official AdMob Testing Ad Unit IDs</span>
                </div>
                {showTestIds ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showTestIds && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs space-y-2">
                  <p className="text-slate-500">
                    When Testing environment is active, WAPCentral automatically dispatches these official public test IDs for Android and iOS devices:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px] pt-1">
                    <div className="p-2 rounded bg-white dark:bg-slate-800 border flex items-center justify-between">
                      <span className="truncate">Android Banner: {ADMOB_OFFICIAL_TEST_IDS.android.bannerAdaptive}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyTestId(ADMOB_OFFICIAL_TEST_IDS.android.bannerAdaptive)}
                        className="h-6 px-1.5 ml-2"
                      >
                        {copiedTestId === ADMOB_OFFICIAL_TEST_IDS.android.bannerAdaptive ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-800 border flex items-center justify-between">
                      <span className="truncate">Android Interstitial: {ADMOB_OFFICIAL_TEST_IDS.android.interstitial}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyTestId(ADMOB_OFFICIAL_TEST_IDS.android.interstitial)}
                        className="h-6 px-1.5 ml-2"
                      >
                        {copiedTestId === ADMOB_OFFICIAL_TEST_IDS.android.interstitial ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-800 border flex items-center justify-between">
                      <span className="truncate">Android Rewarded: {ADMOB_OFFICIAL_TEST_IDS.android.rewarded}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyTestId(ADMOB_OFFICIAL_TEST_IDS.android.rewarded)}
                        className="h-6 px-1.5 ml-2"
                      >
                        {copiedTestId === ADMOB_OFFICIAL_TEST_IDS.android.rewarded ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-800 border flex items-center justify-between">
                      <span className="truncate">Android Native: {ADMOB_OFFICIAL_TEST_IDS.android.native}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyTestId(ADMOB_OFFICIAL_TEST_IDS.android.native)}
                        className="h-6 px-1.5 ml-2"
                      >
                        {copiedTestId === ADMOB_OFFICIAL_TEST_IDS.android.native ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SAVE BUTTON */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                {hasRole('super_admin') && (
                  <Button
                    type="button"
                    variant={isGlobalKilled ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={handleToggleGlobalKill}
                    className="text-xs"
                  >
                    <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                    {isGlobalKilled ? 'Deactivate Global Halt' : 'Emergency Global Halt'}
                  </Button>
                )}
              </div>

              <Button
                type="submit"
                disabled={saving || !hasRole('editor')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 shadow-sm"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {saving ? 'Saving Ads Configuration...' : `Save Ads for ${selectedApp.name}`}
              </Button>
            </div>
          </form>
        )}
      </div>
    </RoleGuard>
  );
};

export default AdsPage;
