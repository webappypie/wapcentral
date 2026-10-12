import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  ErrorState,
  Modal,
} from '@wapcentral/ui';
import {
  Smartphone,
  Layers,
  Bell,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Send,
  Save,
  Shield,
  Eye,
  EyeOff,
  Sliders,
  Clock,
  Sparkles,
  Flame,
  Info,
  Check,
  ShieldCheck,
  Power,
  Key,
  Copy,
  RefreshCw,
  Download,
  FileText,
  Loader2,
  X,
  ExternalLink,
  HelpCircle,
} from 'lucide-react';
import {
  OFFICIAL_AD_TEST_CATALOG,
  ADMOB_OFFICIAL_TEST_IDS,
  type AdTestCatalogEntry,
  type AdCatalogStatus,
} from '@wapcentral/config';
import { useAuth } from '../contexts/AuthContext.js';
import type {
  App,
  AppSimpleAdsConfig,
  AdEnvironment,
  AdStrategy,
  DemandSourceId,
  DemandSourceStatus,
  AppModule,
  NotificationDoc,
  NotificationCategory,
} from '@wapcentral/types';
import {
  subscribeApp,
  updateApp,
  updateAppAdsConfig,
  regenerateAppKey,
  downloadAppIntegrationGuide,
} from '../services/appsService.js';
import {
  subscribeNotifications,
  createNotification,
  sendNotification,
} from '../services/notificationsService.js';

type DetailTab = 'general' | 'ads' | 'notifications';

const AVAILABLE_SERVICES: { id: AppModule; label: string; desc: string }[] = [
  { id: 'ads', label: 'Monetization & Ads', desc: 'AdMob, Meta, AppLovin & House Ads' },
  { id: 'notifications', label: 'Push Notifications', desc: 'FCM push campaigns and in-app alerts' },
  { id: 'promotion', label: 'Cross-Promotion', desc: 'In-house promotional campaigns' },
  { id: 'ai', label: 'AI Gateway', desc: 'Backend LLM and multimodal policies' },
  { id: 'analytics', label: 'Analytics & Events', desc: 'Event telemetry and retention analytics' },
  { id: 'health', label: 'Health Monitoring', desc: 'Uptime and crash tracking' },
  { id: 'ocr', label: 'OCR Engine', desc: 'Optical character recognition processing' },
  { id: 'image_intelligence', label: 'Image Intelligence', desc: 'Neural photo enhancement' },
  { id: 'file_intelligence', label: 'File Intelligence', desc: 'Document analysis and indexing' },
];

export const ApplicationDetailPage: React.FC = () => {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const [activeTab, setActiveTab] = useState<DetailTab>('general');
  const [app, setApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Success / Error alerts
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // ----------------------------------------------------
  // CREDENTIALS STATE & ACTIONS
  // ----------------------------------------------------
  const [showAppKey, setShowAppKey] = useState(false);
  const [copiedField, setCopiedField] = useState<'appId' | 'appKey' | null>(null);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [isDownloadingGuide, setIsDownloadingGuide] = useState(false);

  const handleDownloadGuide = async () => {
    if (!app) return;
    try {
      setIsDownloadingGuide(true);
      setFeedbackError(null);
      await downloadAppIntegrationGuide(app.id, app.name);
      setFeedbackSuccess(`Downloaded integration guide for ${app.name}`);
    } catch (err: any) {
      console.error('Download guide failed:', err);
      setFeedbackError(err?.message || 'Failed to download integration guide.');
    } finally {
      setIsDownloadingGuide(false);
    }
  };

  const handleCopy = async (text: string, field: 'appId' | 'appKey') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleRegenerateKeyAction = async () => {
    if (!app) return;
    setIsRegeneratingKey(true);
    setShowRegenerateConfirm(false);
    setFeedbackError(null);
    setFeedbackSuccess(null);

    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };

    try {
      await regenerateAppKey(app.id, actor);
      setShowAppKey(true);
      setFeedbackSuccess(`X-App-Key updated successfully in Firestore. Previous key has been invalidated.`);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to regenerate App Key.');
    } finally {
      setIsRegeneratingKey(false);
    }
  };

  // ----------------------------------------------------
  // GENERAL TAB FORM STATE
  // ----------------------------------------------------
  const [genName, setGenName] = useState('');
  const [genPackageId, setGenPackageId] = useState('');
  const [genBundleId, setGenBundleId] = useState('');
  const [genVersion, setGenVersion] = useState('1.0.0');
  const [genEnvironment, setGenEnvironment] = useState<'development' | 'staging' | 'production'>('production');
  const [genFirebaseProjectId, setGenFirebaseProjectId] = useState('');
  const [genFirebaseAndroidAppId, setGenFirebaseAndroidAppId] = useState('');
  const [genFirebaseIosAppId, setGenFirebaseIosAppId] = useState('');
  const [genFcmSenderId, setGenFcmSenderId] = useState('');
  const [genStoreUrlAndroid, setGenStoreUrlAndroid] = useState('');
  const [genStoreUrlIos, setGenStoreUrlIos] = useState('');
  const [genModules, setGenModules] = useState<AppModule[]>([]);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  // ----------------------------------------------------
  // ADS TAB FORM STATE
  // ----------------------------------------------------
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [adsEnvironment, setAdsEnvironment] = useState<AdEnvironment>('testing');

  // Ad Strategy & Single Source
  const [adStrategy, setAdStrategy] = useState<AdStrategy>('automatic');
  const [singleSourceNetwork, setSingleSourceNetwork] = useState<DemandSourceId>('applovin');
  const [bundledAdapters, setBundledAdapters] = useState<Record<DemandSourceId, boolean>>({
    applovin: true,
    admob: true,
    meta: true,
    inmobi: true,
    unity: true,
    wapCustomAds: true,
  });

  // Format Toggles
  const [fmtBanner, setFmtBanner] = useState(true);
  const [fmtNative, setFmtNative] = useState(true);
  const [fmtInterstitial, setFmtInterstitial] = useState(true);
  const [fmtRewarded, setFmtRewarded] = useState(true);
  const [fmtAppOpen, setFmtAppOpen] = useState(true);
  const [fmtRewardedInterstitial, setFmtRewardedInterstitial] = useState(false);

  // Demand Sources Toggles
  const [netAdmob, setNetAdmob] = useState(true);
  const [netMeta, setNetMeta] = useState(false);
  const [netApplovin, setNetApplovin] = useState(false);
  const [netInmobi, setNetInmobi] = useState(false);
  const [netUnity, setNetUnity] = useState(false);
  const [netCustomAds, setNetCustomAds] = useState(true);

  // AdMob Production IDs
  const [admobAppId, setAdmobAppId] = useState('');
  const [admobBannerId, setAdmobBannerId] = useState('');
  const [admobNativeId, setAdmobNativeId] = useState('');
  const [admobInterstitialId, setAdmobInterstitialId] = useState('');
  const [admobRewardedId, setAdmobRewardedId] = useState('');
  const [admobAppOpenId, setAdmobAppOpenId] = useState('');
  const [admobRewardedInterstitialId, setAdmobRewardedInterstitialId] = useState('');

  // Meta Production IDs
  const [metaBannerId, setMetaBannerId] = useState('');
  const [metaNativeId, setMetaNativeId] = useState('');
  const [metaInterstitialId, setMetaInterstitialId] = useState('');
  const [metaRewardedId, setMetaRewardedId] = useState('');

  // AppLovin Production IDs
  const [applovinAppId, setApplovinAppId] = useState('');
  const [applovinBannerId, setApplovinBannerId] = useState('');
  const [applovinNativeId, setApplovinNativeId] = useState('');
  const [applovinInterstitialId, setApplovinInterstitialId] = useState('');
  const [applovinRewardedId, setApplovinRewardedId] = useState('');
  const [applovinAppOpenId, setApplovinAppOpenId] = useState('');
  const [applovinRewardedInterstitialId, setApplovinRewardedInterstitialId] = useState('');

  // InMobi Production IDs
  const [inmobiAccountId, setInmobiAccountId] = useState('');
  const [inmobiBannerId, setInmobiBannerId] = useState('');
  const [inmobiNativeId, setInmobiNativeId] = useState('');
  const [inmobiInterstitialId, setInmobiInterstitialId] = useState('');
  const [inmobiRewardedId, setInmobiRewardedId] = useState('');

  // Unity Ads Production IDs
  const [unityGameId, setUnityGameId] = useState('');
  const [unityBannerId, setUnityBannerId] = useState('');
  const [unityInterstitialId, setUnityInterstitialId] = useState('');
  const [unityRewardedId, setUnityRewardedId] = useState('');

  // Ad Testing Catalog State
  const [testPlatform, setTestPlatform] = useState<'android' | 'ios'>('android');
  const [copiedTestId, setCopiedTestId] = useState<string | null>(null);
  const [activeTestGuideModal, setActiveTestGuideModal] = useState<AdTestCatalogEntry | null>(null);

  const [isSavingAds, setIsSavingAds] = useState(false);

  // ----------------------------------------------------
  // NOTIFICATIONS TAB STATE
  // ----------------------------------------------------
  const [notifList, setNotifList] = useState<NotificationDoc[]>([]);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifCategory, setNotifCategory] = useState<NotificationCategory>('SYSTEM');
  const [notifImageUrl, setNotifImageUrl] = useState('');
  const [notifDeepLink, setNotifDeepLink] = useState('');
  const [notifSendNow, setNotifSendNow] = useState(true);
  const [isSendingNotif, setIsSendingNotif] = useState(false);

  // ----------------------------------------------------
  // Realtime App Subscription
  // ----------------------------------------------------
  useEffect(() => {
    if (!appId) return;
    setLoading(true);
    setError(null);

    const unsubApp = subscribeApp(
      appId,
      (loadedApp) => {
        if (!loadedApp) {
          setError(`Application with ID "${appId}" not found in Firestore registry.`);
          setLoading(false);
          return;
        }
        setApp(loadedApp);

        // Populate General State
        setGenName(loadedApp.name || '');
        setGenPackageId(loadedApp.packageId || '');
        setGenBundleId(loadedApp.bundleId || '');
        setGenVersion(loadedApp.version || '1.0.0');
        setGenEnvironment(loadedApp.environment || 'production');
        setGenFirebaseProjectId(loadedApp.firebaseProjectId || '');
        setGenFirebaseAndroidAppId(loadedApp.firebaseAndroidAppId || '');
        setGenFirebaseIosAppId(loadedApp.firebaseIosAppId || '');
        setGenFcmSenderId(loadedApp.fcmSenderId || '');
        setGenStoreUrlAndroid(loadedApp.storeUrl?.android || '');
        setGenStoreUrlIos(loadedApp.storeUrl?.ios || '');
        setGenModules(loadedApp.enabledModules || []);
        setTestPlatform(loadedApp.platform === 'ios' ? 'ios' : 'android');

        // Populate Ads State from simpleAdsConfig
        const adsCfg = loadedApp.simpleAdsConfig;
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
              wapCustomAds: adsCfg.bundledAdapters.wapCustomAds ?? true,
            });
          }
          setFmtBanner(adsCfg.enabledFormats?.banner ?? true);
          setFmtNative(adsCfg.enabledFormats?.native ?? true);
          setFmtInterstitial(adsCfg.enabledFormats?.interstitial ?? true);
          setFmtRewarded(adsCfg.enabledFormats?.rewarded ?? true);
          setFmtAppOpen(adsCfg.enabledFormats?.appOpen ?? true);
          setFmtRewardedInterstitial(adsCfg.enabledFormats?.rewardedInterstitial ?? false);

          setNetAdmob(adsCfg.networks?.admob ?? true);
          setNetMeta(adsCfg.networks?.meta ?? false);
          setNetApplovin(adsCfg.networks?.applovin ?? false);
          setNetInmobi(adsCfg.networks?.inmobi ?? false);
          setNetUnity(adsCfg.networks?.unity ?? false);
          setNetCustomAds(adsCfg.networks?.wapCustomAds ?? true);

          // Production IDs
          const netCfg = adsCfg.networkConfig;
          if (netCfg) {
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

            setApplovinAppId(netCfg.applovin?.appId || '');
            setApplovinBannerId(netCfg.applovin?.placementIds?.['banner'] || '');
            setApplovinNativeId(netCfg.applovin?.placementIds?.['native'] || '');
            setApplovinInterstitialId(netCfg.applovin?.placementIds?.['interstitial'] || '');
            setApplovinRewardedId(netCfg.applovin?.placementIds?.['rewarded'] || '');
            setApplovinAppOpenId(netCfg.applovin?.placementIds?.['app_open'] || '');
            setApplovinRewardedInterstitialId(netCfg.applovin?.placementIds?.['rewarded_interstitial'] || '');

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
          // Defaults if not configured
          setAdsEnabled(false);
          setAdsEnvironment('testing');
          setAdStrategy('automatic');
          setSingleSourceNetwork('applovin');
          setBundledAdapters({
            applovin: true,
            admob: true,
            meta: true,
            inmobi: true,
            unity: true,
            wapCustomAds: true,
          });
        }

        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    // Notifications subscription
    const unsubNotifs = subscribeNotifications((items) => {
      setNotifList(items);
    });

    return () => {
      unsubApp();
      unsubNotifs();
    };
  }, [appId]);

  // ----------------------------------------------------
  // Handlers
  // ----------------------------------------------------
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app) return;
    setIsSavingGeneral(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);

    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };

    const storeUrl: { android?: string; ios?: string } = {};
    if (genStoreUrlAndroid.trim()) storeUrl.android = genStoreUrlAndroid.trim();
    if (genStoreUrlIos.trim()) storeUrl.ios = genStoreUrlIos.trim();

    try {
      await updateApp(
        app.id,
        {
          name: genName.trim(),
          packageId: genPackageId.trim(),
          bundleId: genBundleId.trim() || (app.bundleId ? null : undefined),
          version: genVersion.trim(),
          environment: genEnvironment,
          firebaseProjectId: genFirebaseProjectId.trim() || (app.firebaseProjectId ? null : undefined),
          firebaseAndroidAppId: genFirebaseAndroidAppId.trim() || (app.firebaseAndroidAppId ? null : undefined),
          firebaseIosAppId: genFirebaseIosAppId.trim() || (app.firebaseIosAppId ? null : undefined),
          fcmSenderId: genFcmSenderId.trim() || (app.fcmSenderId ? null : undefined),
          storeUrl: Object.keys(storeUrl).length > 0 ? storeUrl : (app.storeUrl ? null : undefined),
          enabledModules: genModules,
        },
        actor,
      );
      setFeedbackSuccess('Application general & Firebase configuration saved to Firestore.');
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to save application details.');
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // ----------------------------------------------------
  // ADS HELPERS & VALIDATION
  // ----------------------------------------------------
  const getDemandSourceStatus = (source: DemandSourceId): DemandSourceStatus => {
    // If adapter is not bundled in APK/AAB build, remote activation is impossible
    if (!bundledAdapters[source]) {
      return 'requires_app_update';
    }

    switch (source) {
      case 'applovin':
        return applovinAppId.trim() ? 'configured' : 'not_configured';
      case 'admob':
        return admobAppId.trim() ? 'configured' : 'not_configured';
      case 'meta':
        return (metaBannerId.trim() || metaInterstitialId.trim() || metaRewardedId.trim() || metaNativeId.trim())
          ? 'configured'
          : 'not_configured';
      case 'inmobi':
        return inmobiAccountId.trim() ? 'configured' : 'not_configured';
      case 'unity':
        return unityGameId.trim() ? 'configured' : 'not_configured';
      case 'wapCustomAds':
        return 'configured';
      default:
        return 'not_configured';
    }
  };

  const getActiveDemandSources = (): DemandSourceId[] => {
    if (adStrategy === 'single_source') {
      return [singleSourceNetwork];
    }
    const sources: DemandSourceId[] = [];
    if (netApplovin) sources.push('applovin');
    if (netAdmob) sources.push('admob');
    if (netMeta) sources.push('meta');
    if (netInmobi) sources.push('inmobi');
    if (netUnity) sources.push('unity');
    if (netCustomAds) sources.push('wapCustomAds');
    return sources;
  };

  const isFormatSupported = (fmt: string): boolean => {
    const active = getActiveDemandSources();
    if (active.length === 0) return true;
    return active.some((src) => {
      switch (fmt) {
        case 'banner':
        case 'interstitial':
        case 'rewarded':
          return true; // Supported by all 6 sources
        case 'native':
          return src !== 'unity'; // Unity Ads does not support native
        case 'appOpen':
          return src === 'admob' || src === 'applovin' || src === 'wapCustomAds'; // Meta, InMobi, Unity don't support App Open
        case 'rewardedInterstitial':
          return src === 'admob' || src === 'applovin'; // AdMob and AppLovin MAX support Rewarded Interstitial
        default:
          return true;
      }
    });
  };

  const handleCopyTestId = (idText: string) => {
    navigator.clipboard.writeText(idText);
    setCopiedTestId(idText);
    setTimeout(() => {
      setCopiedTestId(null);
    }, 2000);
  };

  const getCatalogRowStatus = (entry: AdTestCatalogEntry): AdCatalogStatus => {
    if (entry.defaultStatus === 'not_supported') return 'not_supported';

    if (entry.providerId === 'applovin') {
      const hasPlacement =
        (entry.formatKey === 'banner_adaptive' && Boolean(applovinBannerId)) ||
        (entry.formatKey === 'banner_fixed' && Boolean(applovinBannerId)) ||
        (entry.formatKey === 'native' && Boolean(applovinNativeId)) ||
        (entry.formatKey === 'interstitial' && Boolean(applovinInterstitialId)) ||
        (entry.formatKey === 'rewarded' && Boolean(applovinRewardedId)) ||
        (entry.formatKey === 'app_open' && Boolean(applovinAppOpenId)) ||
        (entry.formatKey === 'rewarded_interstitial' && Boolean(applovinRewardedInterstitialId));

      return hasPlacement ? 'test_mode_required' : 'requires_provider_setup';
    }

    if (entry.providerId === 'admob') {
      return 'configured';
    }

    if (entry.providerId === 'meta') {
      return 'test_mode_required';
    }

    if (entry.providerId === 'inmobi') {
      const hasPlacement =
        (entry.formatKey === 'banner_adaptive' && Boolean(inmobiBannerId)) ||
        (entry.formatKey === 'banner_fixed' && Boolean(inmobiBannerId)) ||
        (entry.formatKey === 'native' && Boolean(inmobiNativeId)) ||
        (entry.formatKey === 'interstitial' && Boolean(inmobiInterstitialId)) ||
        (entry.formatKey === 'rewarded' && Boolean(inmobiRewardedId));

      return hasPlacement ? 'test_mode_required' : 'requires_provider_setup';
    }

    if (entry.providerId === 'unity') {
      return 'test_mode_required';
    }

    if (entry.providerId === 'custom_ads') {
      return 'configured';
    }

    return entry.defaultStatus;
  };

  const filteredCatalogEntries = useMemo(() => {
    return OFFICIAL_AD_TEST_CATALOG.filter((entry) => {
      // 1. If single demand source is selected:
      if (adStrategy === 'single_source') {
        if (entry.providerId === 'applovin') return true;
        if (entry.providerId === singleSourceNetwork) return true;
        return false;
      }

      // 2. Automatic Mediation:
      if (entry.providerId === 'applovin') return true;
      if (entry.providerId === 'admob' && netAdmob) return true;
      if (entry.providerId === 'meta' && netMeta) return true;
      if (entry.providerId === 'inmobi' && netInmobi) return true;
      if (entry.providerId === 'unity' && netUnity) return true;
      if (entry.providerId === 'custom_ads' && netCustomAds) return true;

      return false;
    });
  }, [adStrategy, singleSourceNetwork, netAdmob, netMeta, netInmobi, netUnity, netCustomAds]);

  const handleSaveAds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app) return;
    setIsSavingAds(true);
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
        admob: netAdmob,
        meta: netMeta,
        applovin: netApplovin,
        inmobi: netInmobi,
        unity: netUnity,
        wapCustomAds: netCustomAds,
      },
      networkConfig: {
        enabled: true,
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
          campaignEnabled: netCustomAds,
        },
      },
    };

    try {
      await updateAppAdsConfig(app.id, newAdsConfig, actor);
      setFeedbackSuccess(`Ads configuration for ${app.name} updated successfully in Firestore.`);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to update ads configuration.');
    } finally {
      setIsSavingAds(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app) return;
    if (!notifTitle.trim() || !notifMessage.trim()) {
      setFeedbackError('Title and message are required.');
      return;
    }

    setIsSendingNotif(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);

    try {
      const created = await createNotification({
        title: notifTitle.trim(),
        message: notifMessage.trim(),
        category: notifCategory,
        type: 'system',
        priority: 'normal',
        targetType: 'specific_app',
        targetAppIds: [app.id],
        imageUrl: notifImageUrl.trim() || undefined,
        deepLink: notifDeepLink.trim() || undefined,
        sound: 'default',
        badge: 1,
        schedule: notifSendNow ? 'now' : undefined,
        isMandatory: false,
      });

      if (notifSendNow) {
        await sendNotification(created.id);
        setFeedbackSuccess(`Push notification dispatched to ${app.name} devices via FCM.`);
      } else {
        setFeedbackSuccess(`Notification for ${app.name} saved as draft.`);
      }

      setNotifTitle('');
      setNotifMessage('');
      setNotifImageUrl('');
      setNotifDeepLink('');
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to send notification.');
    } finally {
      setIsSendingNotif(false);
    }
  };

  const toggleModule = (mod: AppModule) => {
    setGenModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  };

  // App notifications filter
  const appNotifications = notifList.filter(
    (n) => n.targetType === 'all_apps' || n.targetAppIds?.includes(app?.id || ''),
  );

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center space-y-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading application configuration...</p>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="p-6">
        <ErrorState
          title="Application Not Found"
          message={error || 'Unable to retrieve app configuration from Firestore.'}
          onRetry={() => navigate('/apps')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/apps')}
          className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" /> Back to App Registry
        </Button>
        <div className="flex items-center gap-2">
          <Badge
            variant={app.platform === 'android' ? 'success' : app.platform === 'ios' ? 'default' : 'secondary'}
            className="capitalize text-xs"
          >
            {app.platform}
          </Badge>
          <Badge
            variant={app.environment === 'production' ? 'default' : 'warning'}
            className="capitalize text-xs font-mono"
          >
            {app.environment}
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            v{app.version}
          </Badge>
        </div>
      </div>

      <PageHeader
        title={app.name}
        description={`Complete centralized configuration: General, Monetization Ads, and Push Notifications for ${app.packageId}.`}
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

      {/* APPLICATION CREDENTIALS */}
      <Card className="border border-indigo-200/80 bg-white dark:border-indigo-900/60 dark:bg-slate-900/90 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <Key className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Application Credentials
                  <Badge variant="outline" className="text-[10px] font-mono border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
                    Platform API & SDK Auth
                  </Badge>
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Expected HTTP headers: <code className="font-mono text-indigo-600 dark:text-indigo-400">X-App-Id</code> and <code className="font-mono text-indigo-600 dark:text-indigo-400">X-App-Key</code>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                onClick={handleDownloadGuide}
                disabled={isDownloadingGuide}
                className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-1.5 shadow-sm transition-all"
                title="Download app-specific integration guide (.md)"
              >
                {isDownloadingGuide ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Integration Guide (.md)</span>
                  </>
                )}
              </Button>
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-[11px] font-medium">Role-Protected</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* App ID */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  App ID
                </label>
                <span className="text-[10px] font-mono text-slate-500">
                  Header: X-App-Id
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <span className="truncate select-all">{app.id}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(app.id, 'appId')}
                  className="shrink-0 h-7 px-2.5 text-xs flex items-center gap-1"
                >
                  {copiedField === 'appId' ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy App ID</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* X-App-Key */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  X-App-Key
                </label>
                <span className="text-[10px] font-mono text-slate-500">
                  Header: X-App-Key
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <span className="truncate select-all text-slate-700 dark:text-slate-300">
                  {app.appKey
                    ? showAppKey
                      ? app.appKey
                      : '••••••••••••••••••••••••'
                    : 'No key generated yet'}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {app.appKey ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAppKey(!showAppKey)}
                        className="h-7 px-2 text-xs flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        title={showAppKey ? 'Hide App Key' : 'Show App Key'}
                      >
                        {showAppKey ? (
                          <>
                            <EyeOff className="h-3 w-3" />
                            <span className="hidden sm:inline">Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3" />
                            <span className="hidden sm:inline">Show</span>
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(app.appKey || '', 'appKey')}
                        className="h-7 px-2.5 text-xs flex items-center gap-1"
                      >
                        {copiedField === 'appKey' ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy Key</span>
                          </>
                        )}
                      </Button>
                      {hasRole('editor') && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowRegenerateConfirm(true)}
                          disabled={isRegeneratingKey}
                          className="h-7 px-2.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/60 dark:hover:bg-rose-950/40 flex items-center gap-1"
                        >
                          <RefreshCw className={`h-3 w-3 ${isRegeneratingKey ? 'animate-spin' : ''}`} />
                          <span>Regenerate Key</span>
                        </Button>
                      )}
                    </>
                  ) : (
                    hasRole('editor') && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleRegenerateKeyAction}
                        disabled={isRegeneratingKey}
                        className="h-7 px-3 text-xs flex items-center gap-1"
                      >
                        <RefreshCw className={`h-3 w-3 ${isRegeneratingKey ? 'animate-spin' : ''}`} />
                        <span>Generate App Key</span>
                      </Button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Developer Resources Banner */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/30 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Developer Resources &amp; Integration Guide (.md)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Auto-generated Markdown developer documentation pre-filled with {app.name}&apos;s real credentials, SDKs, and endpoints.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleCopy(app.id, 'appId')}
                className="h-7 px-2.5 text-xs flex items-center gap-1"
              >
                {copiedField === 'appId' ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied ID</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy App ID</span>
                  </>
                )}
              </Button>
              {app.appKey && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(app.appKey || '', 'appKey')}
                  className="h-7 px-2.5 text-xs flex items-center gap-1"
                >
                  {copiedField === 'appKey' ? (
                     <>
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied Key</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy X-App-Key</span>
                    </>
                  )}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleDownloadGuide}
                disabled={isDownloadingGuide}
                className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-1.5 shadow-sm"
              >
                {isDownloadingGuide ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Integration Guide (.md)</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* REGENERATE CONFIRMATION MODAL */}
      {showRegenerateConfirm && (
        <Modal
          isOpen={showRegenerateConfirm}
          onClose={() => setShowRegenerateConfirm(false)}
          title="Regenerate X-App-Key"
          description={`Invalidate existing key and generate a new secret credential for ${app.name}.`}
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowRegenerateConfirm(false)}
                disabled={isRegeneratingKey}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRegenerateKeyAction}
                isLoading={isRegeneratingKey}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Confirm & Invalidate Previous Key</span>
              </Button>
            </>
          }
        >
          <div className="space-y-3 py-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-semibold">Warning: This action immediately invalidates the previous key.</p>
                <p className="mt-1">
                  Any mobile client, Flutter SDK instance, or platform service currently using the existing <code className="font-mono font-bold">X-App-Key</code> will fail authentication until updated with the newly generated key.
                </p>
              </div>
            </div>
            <p>
              Are you sure you want to proceed with regenerating the key for <strong>{app.name}</strong> ({app.packageId})?
            </p>
          </div>
        </Modal>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            [General] App & Firebase
          </button>

          <button
            onClick={() => setActiveTab('ads')}
            className={`flex items-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'ads'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="h-4 w-4" />
            [Ads] Monetization & Testing
            {adsEnabled && (
              <span className="ml-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-mono">
                {adsEnvironment.toUpperCase()}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'notifications'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Bell className="h-4 w-4" />
            [Notifications] Send & History
            <span className="ml-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 text-[10px] font-mono">
              {appNotifications.length}
            </span>
          </button>
        </nav>
      </div>

      {/* ========================================================
          TAB 1: GENERAL
          ======================================================== */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="space-y-6">
          <Card>
            <CardHeader title="Application Metadata" />
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    App Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={genName}
                    onChange={(e) => setGenName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Android Package ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={genPackageId}
                    onChange={(e) => setGenPackageId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    iOS Bundle ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={genBundleId}
                    onChange={(e) => setGenBundleId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Version
                  </label>
                  <input
                    type="text"
                    value={genVersion}
                    onChange={(e) => setGenVersion(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Environment
                  </label>
                  <select
                    value={genEnvironment}
                    onChange={(e) => setGenEnvironment(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Google Play Store URL
                  </label>
                  <input
                    type="url"
                    value={genStoreUrlAndroid}
                    onChange={(e) => setGenStoreUrlAndroid(e.target.value)}
                    placeholder="https://play.google.com/store/apps/..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Apple App Store URL
                  </label>
                  <input
                    type="url"
                    value={genStoreUrlIos}
                    onChange={(e) => setGenStoreUrlIos(e.target.value)}
                    placeholder="https://apps.apple.com/app/..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Firebase Credentials Card */}
          <Card>
            <CardHeader title="Firebase & Push Services Configuration" />
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Firebase Project ID
                  </label>
                  <input
                    type="text"
                    value={genFirebaseProjectId}
                    onChange={(e) => setGenFirebaseProjectId(e.target.value)}
                    placeholder="e.g. filezen-production"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    FCM Sender ID (Project Number)
                  </label>
                  <input
                    type="text"
                    value={genFcmSenderId}
                    onChange={(e) => setGenFcmSenderId(e.target.value)}
                    placeholder="e.g. 109283746501"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Firebase Android App ID
                  </label>
                  <input
                    type="text"
                    value={genFirebaseAndroidAppId}
                    onChange={(e) => setGenFirebaseAndroidAppId(e.target.value)}
                    placeholder="1:109283746501:android:abc12345"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Firebase iOS App ID
                  </label>
                  <input
                    type="text"
                    value={genFirebaseIosAppId}
                    onChange={(e) => setGenFirebaseIosAppId(e.target.value)}
                    placeholder="1:109283746501:ios:abc12345"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enabled WAP Services */}
          <Card>
            <CardHeader title="Enabled WAPCentral Services & Modules" />
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {AVAILABLE_SERVICES.map((s) => {
                  const isChecked = genModules.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleModule(s.id)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                          {s.label}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-tight mt-0.5">
                          {s.desc}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSavingGeneral || !hasRole('editor')}>
              <Save className="h-4 w-4 mr-1.5" />
              {isSavingGeneral ? 'Saving...' : 'Save General Settings'}
            </Button>
          </div>
        </form>
      )}

      {/* ========================================================
          TAB 2: ADS (APP-CENTRIC MONETIZATION)
          ======================================================== */}
      {activeTab === 'ads' && (
        <form onSubmit={handleSaveAds} className="space-y-6">
          {/* Architecture Banner: AppLovin MAX Sole Mediation */}
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-slate-50 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-600 text-white shadow-sm">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Mediation Engine: AppLovin MAX
                    </h3>
                    <Badge variant="outline" className="border-indigo-300 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                      Sole Mediation Engine
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Unified competition across AppLovin, AdMob, Meta, InMobi, and Unity Ads without redundant SDKs or duplicate mediation engines (No Unity LevelPlay).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-400 text-xs font-mono">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Dynamic Remote Config
                </Badge>
              </div>
            </div>
          </div>

          {/* Master Switch & Environment */}
          <Card className="border-2 border-indigo-200 dark:border-indigo-900">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl transition-colors ${adsEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-800'}`}>
                    <Power className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Ads Monetization Master Switch
                    </h3>
                    <p className="text-xs text-slate-500">
                      Controls whether the wap_ads_sdk delivers active ads to {app.name}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Environment Switch */}
                  <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-1">
                    <button
                      type="button"
                      onClick={() => setAdsEnvironment('testing')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        adsEnvironment === 'testing'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      Testing Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdsEnvironment('production')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        adsEnvironment === 'production'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      Production Mode
                    </button>
                  </div>

                  {/* Master Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adsEnabled}
                      onChange={(e) => setAdsEnabled(e.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {adsEnabled ? 'ADS ENABLED (ON)' : 'ADS DISABLED (OFF)'}
                    </span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Testing Mode vs Production Mode Alert */}
          {adsEnvironment === 'testing' ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">Central Testing Mode is Active for {app.name}</p>
                <p>
                  Official SDK test mode and sample test unit IDs are automatically injected for AdMob, Meta, MAX, InMobi, and Unity.
                  Developers do NOT need to look up or enter test IDs manually.
                  Never simulates fake or placeholder ads.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50/70 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">Production Mode is Active for {app.name}</p>
                <p>
                  Only configured production IDs will be served to end-user devices. Networks missing production credentials will show <strong>Not configured</strong> and will be skipped safely without crashing the app. Test IDs are strictly forbidden in production.
                </p>
              </div>
            </div>
          )}

          {/* CENTRAL TESTING MODE: OFFICIAL AD TESTING CONFIGURATION */}
          {adsEnvironment === 'testing' && (
            <Card className="border-amber-300 dark:border-amber-900 bg-gradient-to-b from-amber-50/50 via-white to-white dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 shadow-sm">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-amber-200 dark:border-amber-900/60 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                      Official Ad Testing Configuration (Central Testing Mode)
                    </CardTitle>
                    <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px]">
                      Mediation: AppLovin MAX
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    AppLovin MAX is our selected mediation engine. Verified official test IDs and testing mechanisms for every supported format are listed below. Test ads must be verified on a physical device using official provider testing tools.
                  </p>
                </div>

                {/* Target Platform Switcher */}
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Target Platform:</span>
                  <div className="flex rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setTestPlatform('android')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                        testPlatform === 'android'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      Android
                    </button>
                    <button
                      type="button"
                      onClick={() => setTestPlatform('ios')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                        testPlatform === 'ios'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      iOS
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 font-semibold">
                        <th className="py-2.5 px-3">Provider</th>
                        <th className="py-2.5 px-3">Format</th>
                        <th className="py-2.5 px-3">Testing Method / Test ID</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredCatalogEntries.map((entry, idx) => {
                        const status = getCatalogRowStatus(entry);
                        const sampleId = testPlatform === 'ios' ? entry.iosSampleId : entry.androidSampleId;

                        return (
                          <tr key={`${entry.providerId}-${entry.formatKey}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                            {/* Provider */}
                            <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${
                                  entry.providerId === 'applovin' ? 'bg-red-500' :
                                  entry.providerId === 'admob' ? 'bg-blue-500' :
                                  entry.providerId === 'meta' ? 'bg-blue-600' :
                                  entry.providerId === 'inmobi' ? 'bg-emerald-600' :
                                  entry.providerId === 'unity' ? 'bg-slate-900 dark:bg-slate-100' : 'bg-emerald-500'
                                }`} />
                                <span>{entry.providerName}</span>
                              </div>
                            </td>

                            {/* Format */}
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                              {entry.formatLabel}
                            </td>

                            {/* Testing Method / Test ID */}
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                              <div className="space-y-1 max-w-md">
                                <div className="text-[11px] leading-tight">
                                  {entry.providerId === 'applovin' ? (
                                    <span>
                                      MAX Test Mode / Mediation Debugger (<code>AppLovinMAX.showMediationDebugger()</code>) using app MAX Ad Unit ID:
                                      {entry.formatKey === 'banner_adaptive' && (applovinBannerId ? <code className="ml-1 px-1 py-0.5 bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded">{applovinBannerId}</code> : <span className="ml-1 text-slate-400 italic">(Not configured)</span>)}
                                      {entry.formatKey === 'native' && (applovinNativeId ? <code className="ml-1 px-1 py-0.5 bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded">{applovinNativeId}</code> : <span className="ml-1 text-slate-400 italic">(Not configured)</span>)}
                                      {entry.formatKey === 'interstitial' && (applovinInterstitialId ? <code className="ml-1 px-1 py-0.5 bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded">{applovinInterstitialId}</code> : <span className="ml-1 text-slate-400 italic">(Not configured)</span>)}
                                      {entry.formatKey === 'rewarded' && (applovinRewardedId ? <code className="ml-1 px-1 py-0.5 bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded">{applovinRewardedId}</code> : <span className="ml-1 text-slate-400 italic">(Not configured)</span>)}
                                      {entry.formatKey === 'app_open' && (applovinAppOpenId ? <code className="ml-1 px-1 py-0.5 bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded">{applovinAppOpenId}</code> : <span className="ml-1 text-slate-400 italic">(Not configured)</span>)}
                                      {entry.formatKey === 'rewarded_interstitial' && (applovinRewardedInterstitialId ? <code className="ml-1 px-1 py-0.5 bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded">{applovinRewardedInterstitialId}</code> : <span className="ml-1 text-slate-400 italic">(Not configured)</span>)}
                                    </span>
                                  ) : (
                                    <span>{entry.testingMethod}</span>
                                  )}
                                </div>

                                {sampleId && (
                                  <div className="flex items-center gap-1.5 pt-0.5">
                                    <code className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                      {sampleId}
                                    </code>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyTestId(sampleId)}
                                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                                      title="Copy test ID"
                                    >
                                      {copiedTestId === sampleId ? (
                                        <Check className="h-3 w-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {status === 'configured' && (
                                <Badge variant="default" className="bg-emerald-600 text-white text-[10px] font-semibold">
                                  Configured
                                </Badge>
                              )}
                              {status === 'test_mode_required' && (
                                <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 text-[10px] font-semibold">
                                  Test mode required
                                </Badge>
                              )}
                              {status === 'requires_provider_setup' && (
                                <Badge variant="outline" className="border-indigo-400 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700 text-[10px] font-semibold">
                                  Requires provider setup
                                </Badge>
                              )}
                              {status === 'not_supported' && (
                                <Badge variant="secondary" className="bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[10px]">
                                  Not supported
                                </Badge>
                              )}
                            </td>

                            {/* Action */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {sampleId ? (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyTestId(sampleId)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    title="Copy official test ID"
                                  >
                                    {copiedTestId === sampleId ? (
                                      <>
                                        <Check className="h-3 w-3 text-emerald-600" />
                                        <span className="text-emerald-600 font-bold">Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3 w-3 text-slate-500" />
                                        <span>Copy ID</span>
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic px-1">No test ID</span>
                                )}

                                <a
                                  href={entry.documentationUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                  title="View official documentation"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span>Docs</span>
                                </a>

                                <button
                                  type="button"
                                  onClick={() => setActiveTestGuideModal(entry)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                                  title="View testing instructions & code snippet"
                                >
                                  <HelpCircle className="h-3 w-3" />
                                  <span>Test Config</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 1. AD STRATEGY SELECTOR */}
          <Card>
            <CardHeader title="1. Ad Strategy" />
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Automatic Mediation Option */}
                <div
                  onClick={() => setAdStrategy('automatic')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    adStrategy === 'automatic'
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 dark:border-indigo-500 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          Automatic Mediation
                        </span>
                        <Badge variant="default" className="bg-indigo-600 text-[10px]">
                          Recommended
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        AppLovin MAX unifies competition and selects among enabled, available demand sources in real time using MAX bidding and waterfall optimization.
                      </p>
                    </div>
                    <input
                      type="radio"
                      name="ad_strategy"
                      checked={adStrategy === 'automatic'}
                      onChange={() => setAdStrategy('automatic')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Single Demand Source Option */}
                <div
                  onClick={() => setAdStrategy('single_source')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    adStrategy === 'single_source'
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 dark:border-indigo-500 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        Single Demand Source
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        Route all ad traffic through MAX exclusively to one selected demand source while retaining MAX as the underlying mediation engine.
                      </p>
                    </div>
                    <input
                      type="radio"
                      name="ad_strategy"
                      checked={adStrategy === 'single_source'}
                      onChange={() => setAdStrategy('single_source')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>

                  {adStrategy === 'single_source' && (
                    <div className="mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-800">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Select Single Demand Source:
                      </label>
                      <select
                        value={singleSourceNetwork}
                        onChange={(e) => setSingleSourceNetwork(e.target.value as DemandSourceId)}
                        className="w-full rounded-md border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium"
                      >
                        <option value="applovin">AppLovin Demand (MAX Core)</option>
                        <option value="admob">Google AdMob</option>
                        <option value="meta">Meta Audience Network</option>
                        <option value="inmobi">InMobi</option>
                        <option value="unity">Unity Ads</option>
                        <option value="wapCustomAds">WebAppyPie Custom House Ads</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. LIGHTWEIGHT SDK STRATEGY: BUNDLED ADAPTERS */}
          <Card>
            <CardHeader title="2. Mobile App Build Adapters (Lightweight SDK Strategy)" />
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500">
                Declare which network adapters are compiled into this application's APK/AAB build. Unbundled adapters cannot be enabled remotely without an app update.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'applovin' as DemandSourceId, label: 'AppLovin MAX Core' },
                  { id: 'admob' as DemandSourceId, label: 'AdMob Adapter' },
                  { id: 'meta' as DemandSourceId, label: 'Meta Adapter' },
                  { id: 'inmobi' as DemandSourceId, label: 'InMobi Adapter' },
                  { id: 'unity' as DemandSourceId, label: 'Unity Ads Adapter' },
                  { id: 'wapCustomAds' as DemandSourceId, label: 'Custom Ads Hook' },
                ].map((adapter) => {
                  const isBundled = Boolean(bundledAdapters[adapter.id]);
                  return (
                    <button
                      key={adapter.id}
                      type="button"
                      onClick={() => {
                        setBundledAdapters({
                          ...bundledAdapters,
                          [adapter.id]: !isBundled,
                        });
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        isBundled
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${isBundled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {adapter.label}
                      <span className="text-[10px] font-mono opacity-80">
                        {isBundled ? '(Bundled)' : '(Not in build)'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                WAPCentral strictly isolates adapters to prevent APK/AAB bloat. If a network is enabled remotely while its adapter is absent from the app build, it displays <strong>Requires app update</strong> and is excluded from the mediation payload to protect app startup performance.
              </p>
            </CardContent>
          </Card>

          {/* 3. DEMAND SOURCES */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                3. Demand Sources & Provider Configuration
              </h3>
              <span className="text-xs text-slate-500">
                MAX Mediation Demand Partners
              </span>
            </div>

            {/* AppLovin MAX Core */}
            <Card className={netApplovin ? 'border-indigo-300 dark:border-indigo-900' : 'opacity-80'}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <CardTitle className="text-sm font-semibold">AppLovin Demand (MAX Core)</CardTitle>
                  {(() => {
                    const status = getDemandSourceStatus('applovin');
                    if (status === 'requires_app_update' && netApplovin) {
                      return <Badge variant="destructive" className="text-[10px]">Requires app update</Badge>;
                    }
                    if (status === 'configured') {
                      return <Badge variant="default" className="bg-emerald-600 text-[10px]">Configured</Badge>;
                    }
                    return <Badge variant="secondary" className="text-[10px]">Not configured</Badge>;
                  })()}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={netApplovin}
                    onChange={(e) => setNetApplovin(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {netApplovin ? 'AppLovin Enabled' : 'AppLovin Disabled'}
                  </span>
                </label>
              </CardHeader>
              <CardContent className="space-y-3">
                {adsEnvironment === 'testing' && (
                  <div className="rounded-lg bg-amber-50/80 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 p-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                    <span>✓ <strong>MAX Test Mode Active</strong>: Injected with official MAX test bids. Enter your app MAX Ad Unit IDs below to test with test devices / Mediation Debugger.</span>
                    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 text-[10px]">Test Device Mode</Badge>
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      AppLovin SDK Key / App ID *
                    </label>
                    <input
                      type="text"
                      value={applovinAppId}
                      onChange={(e) => setApplovinAppId(e.target.value)}
                      placeholder="applovin_sdk_key_..."
                      className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Banner Ad Unit ID</label>
                      <input
                        type="text"
                        value={applovinBannerId}
                        onChange={(e) => setApplovinBannerId(e.target.value)}
                        placeholder="ad_unit_banner"
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Native Ad Unit ID</label>
                      <input
                        type="text"
                        value={applovinNativeId}
                        onChange={(e) => setApplovinNativeId(e.target.value)}
                        placeholder="ad_unit_native"
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Interstitial Ad Unit ID</label>
                      <input
                        type="text"
                        value={applovinInterstitialId}
                        onChange={(e) => setApplovinInterstitialId(e.target.value)}
                        placeholder="ad_unit_interstitial"
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Rewarded Ad Unit ID</label>
                      <input
                        type="text"
                        value={applovinRewardedId}
                        onChange={(e) => setApplovinRewardedId(e.target.value)}
                        placeholder="ad_unit_rewarded"
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">App Open Ad Unit ID</label>
                      <input
                        type="text"
                        value={applovinAppOpenId}
                        onChange={(e) => setApplovinAppOpenId(e.target.value)}
                        placeholder="ad_unit_app_open"
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Rewarded Interstitial ID</label>
                      <input
                        type="text"
                        value={applovinRewardedInterstitialId}
                        onChange={(e) => setApplovinRewardedInterstitialId(e.target.value)}
                        placeholder="ad_unit_rewarded_interstitial"
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Google AdMob */}
            <Card className={netAdmob ? 'border-indigo-300 dark:border-indigo-900' : 'opacity-80'}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <CardTitle className="text-sm font-semibold">Google AdMob</CardTitle>
                  {(() => {
                    const status = getDemandSourceStatus('admob');
                    if (status === 'requires_app_update' && netAdmob) {
                      return <Badge variant="destructive" className="text-[10px]">Requires app update</Badge>;
                    }
                    if (status === 'configured') {
                      return <Badge variant="default" className="bg-emerald-600 text-[10px]">Configured</Badge>;
                    }
                    return <Badge variant="secondary" className="text-[10px]">Not configured</Badge>;
                  })()}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={netAdmob}
                    onChange={(e) => setNetAdmob(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {netAdmob ? 'AdMob Enabled' : 'AdMob Disabled'}
                  </span>
                </label>
              </CardHeader>
              <CardContent className="space-y-3">
                {adsEnvironment === 'testing' && (
                  <div className="rounded-lg bg-amber-50/80 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 p-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                    <span>✓ <strong>Official AdMob Test Mode Active</strong>: Automatically serving verified Google sample ad units ({testPlatform === 'ios' ? ADMOB_OFFICIAL_TEST_IDS.ios.appId : ADMOB_OFFICIAL_TEST_IDS.android.appId}) without manually looking up test IDs.</span>
                    <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-300 text-[10px]">Sample IDs Active</Badge>
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      AdMob Production App ID *
                    </label>
                    <input
                      type="text"
                      value={admobAppId}
                      onChange={(e) => setAdmobAppId(e.target.value)}
                      placeholder="ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"
                      className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Banner Ad Unit ID</label>
                      <input
                        type="text"
                        value={admobBannerId}
                        onChange={(e) => setAdmobBannerId(e.target.value)}
                        placeholder="ca-app-pub-.../..."
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Native Ad Unit ID</label>
                      <input
                        type="text"
                        value={admobNativeId}
                        onChange={(e) => setAdmobNativeId(e.target.value)}
                        placeholder="ca-app-pub-.../..."
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Interstitial Ad Unit ID</label>
                      <input
                        type="text"
                        value={admobInterstitialId}
                        onChange={(e) => setAdmobInterstitialId(e.target.value)}
                        placeholder="ca-app-pub-.../..."
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Rewarded Ad Unit ID</label>
                      <input
                        type="text"
                        value={admobRewardedId}
                        onChange={(e) => setAdmobRewardedId(e.target.value)}
                        placeholder="ca-app-pub-.../..."
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">App Open Ad Unit ID</label>
                      <input
                        type="text"
                        value={admobAppOpenId}
                        onChange={(e) => setAdmobAppOpenId(e.target.value)}
                        placeholder="ca-app-pub-.../..."
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Rewarded Interstitial ID</label>
                      <input
                        type="text"
                        value={admobRewardedInterstitialId}
                        onChange={(e) => setAdmobRewardedInterstitialId(e.target.value)}
                        placeholder="ca-app-pub-.../..."
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Meta Audience Network */}
            <Card className={netMeta ? 'border-indigo-300 dark:border-indigo-900' : 'opacity-80'}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-600" />
                  <CardTitle className="text-sm font-semibold">Meta Audience Network</CardTitle>
                  {(() => {
                    const status = getDemandSourceStatus('meta');
                    if (status === 'requires_app_update' && netMeta) {
                      return <Badge variant="destructive" className="text-[10px]">Requires app update</Badge>;
                    }
                    if (status === 'configured') {
                      return <Badge variant="default" className="bg-emerald-600 text-[10px]">Configured</Badge>;
                    }
                    return <Badge variant="secondary" className="text-[10px]">Not configured</Badge>;
                  })()}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={netMeta}
                    onChange={(e) => setNetMeta(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {netMeta ? 'Meta Enabled' : 'Meta Disabled'}
                  </span>
                </label>
              </CardHeader>
              <CardContent className="space-y-3">
                {adsEnvironment === 'testing' && (
                  <div className="rounded-lg bg-amber-50/80 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 p-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                    <span>✓ <strong>Meta Audience Network Testing</strong>: Mediated through AppLovin MAX. Test ads require adding device test hash in Meta Monetization Manager or enabling Test Mode. Enter production Placement IDs below.</span>
                    <Badge variant="outline" className="border-indigo-400 text-indigo-700 dark:text-indigo-300 text-[10px]">MAX Mediated</Badge>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Banner Placement ID</label>
                    <input
                      type="text"
                      value={metaBannerId}
                      onChange={(e) => setMetaBannerId(e.target.value)}
                      placeholder="IMG_16_9_APP_INSTALL#..."
                      className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Native Placement ID</label>
                    <input
                      type="text"
                      value={metaNativeId}
                      onChange={(e) => setMetaNativeId(e.target.value)}
                      placeholder="IMG_16_9_APP_INSTALL#..."
                      className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Interstitial Placement ID</label>
                    <input
                      type="text"
                      value={metaInterstitialId}
                      onChange={(e) => setMetaInterstitialId(e.target.value)}
                      placeholder="VID_HD_9_16_39S_APP_INSTALL#..."
                      className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Rewarded Placement ID</label>
                    <input
                      type="text"
                      value={metaRewardedId}
                      onChange={(e) => setMetaRewardedId(e.target.value)}
                      placeholder="VID_HD_9_16_39S_APP_INSTALL#..."
                      className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* InMobi */}
            <Card className={netInmobi ? 'border-indigo-300 dark:border-indigo-900' : 'opacity-80'}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-600" />
                  <CardTitle className="text-sm font-semibold">InMobi</CardTitle>
                  {(() => {
                    const status = getDemandSourceStatus('inmobi');
                    if (status === 'requires_app_update' && netInmobi) {
                      return <Badge variant="destructive" className="text-[10px]">Requires app update</Badge>;
                    }
                    if (status === 'configured') {
                      return <Badge variant="default" className="bg-emerald-600 text-[10px]">Configured</Badge>;
                    }
                    return <Badge variant="secondary" className="text-[10px]">Not configured</Badge>;
                  })()}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={netInmobi}
                    onChange={(e) => setNetInmobi(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {netInmobi ? 'InMobi Enabled' : 'InMobi Disabled'}
                  </span>
                </label>
              </CardHeader>
              <CardContent className="space-y-3">
                {adsEnvironment === 'testing' && (
                  <div className="rounded-lg bg-amber-50/80 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 p-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                    <span>✓ <strong>InMobi Testing Mode</strong>: Requires real Account & Placement IDs with "Test Mode" toggled ON in the InMobi portal or tested via MAX Mediation Debugger. Enter production IDs below.</span>
                    <Badge variant="outline" className="border-emerald-400 text-emerald-700 dark:text-emerald-300 text-[10px]">Portal Toggle</Badge>
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      InMobi Account ID *
                    </label>
                    <input
                      type="text"
                      value={inmobiAccountId}
                      onChange={(e) => setInmobiAccountId(e.target.value)}
                      placeholder="e.g. 4028cb8b2c3a5b80012c3bc44ef50077"
                      className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Banner Placement ID</label>
                      <input
                        type="text"
                        value={inmobiBannerId}
                        onChange={(e) => setInmobiBannerId(e.target.value)}
                        placeholder="e.g. 1612345678901"
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Native Placement ID</label>
                      <input
                        type="text"
                        value={inmobiNativeId}
                        onChange={(e) => setInmobiNativeId(e.target.value)}
                        placeholder="e.g. 1612345678902"
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Interstitial Placement ID</label>
                      <input
                        type="text"
                        value={inmobiInterstitialId}
                        onChange={(e) => setInmobiInterstitialId(e.target.value)}
                        placeholder="e.g. 1612345678903"
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Rewarded Placement ID</label>
                      <input
                        type="text"
                        value={inmobiRewardedId}
                        onChange={(e) => setInmobiRewardedId(e.target.value)}
                        placeholder="e.g. 1612345678904"
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Unity Ads */}
            <Card className={netUnity ? 'border-indigo-300 dark:border-indigo-900' : 'opacity-80'}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-slate-900 dark:bg-white" />
                  <CardTitle className="text-sm font-semibold">Unity Ads</CardTitle>
                  {(() => {
                    const status = getDemandSourceStatus('unity');
                    if (status === 'requires_app_update' && netUnity) {
                      return <Badge variant="destructive" className="text-[10px]">Requires app update</Badge>;
                    }
                    if (status === 'configured') {
                      return <Badge variant="default" className="bg-emerald-600 text-[10px]">Configured</Badge>;
                    }
                    return <Badge variant="secondary" className="text-[10px]">Not configured</Badge>;
                  })()}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={netUnity}
                    onChange={(e) => setNetUnity(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {netUnity ? 'Unity Enabled' : 'Unity Disabled'}
                  </span>
                </label>
              </CardHeader>
              <CardContent className="space-y-3">
                {adsEnvironment === 'testing' && (
                  <div className="rounded-lg bg-amber-50/80 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 p-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                    <span>✓ <strong>Unity Ads Testing Mode</strong>: Requires real Game ID & Placement IDs with "Test Mode" toggled ON in Unity Cloud Dashboard. Enter production IDs below.</span>
                    <Badge variant="outline" className="border-slate-400 text-slate-700 dark:text-slate-300 text-[10px]">Dashboard Toggle</Badge>
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Unity Game ID *
                    </label>
                    <input
                      type="text"
                      value={unityGameId}
                      onChange={(e) => setUnityGameId(e.target.value)}
                      placeholder="e.g. 5234567"
                      className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Banner Placement ID</label>
                      <input
                        type="text"
                        value={unityBannerId}
                        onChange={(e) => setUnityBannerId(e.target.value)}
                        placeholder="e.g. Banner_Android"
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Interstitial Placement ID</label>
                      <input
                        type="text"
                        value={unityInterstitialId}
                        onChange={(e) => setUnityInterstitialId(e.target.value)}
                        placeholder="e.g. Interstitial_Android"
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Rewarded Placement ID</label>
                      <input
                        type="text"
                        value={unityRewardedId}
                        onChange={(e) => setUnityRewardedId(e.target.value)}
                        placeholder="e.g. Rewarded_Android"
                        className="w-full rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Custom House Ads */}
            <Card className={netCustomAds ? 'border-emerald-300 dark:border-emerald-900' : 'opacity-80'}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <CardTitle className="text-sm font-semibold">WebAppyPie Custom Ads</CardTitle>
                  <Badge variant="default" className="bg-emerald-600 text-[10px]">Configured</Badge>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={netCustomAds}
                    onChange={(e) => setNetCustomAds(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {netCustomAds ? 'Custom Ads Enabled' : 'Custom Ads Disabled'}
                  </span>
                </label>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">
                  WebAppyPie first-party promotional campaigns are managed centrally in WAPCentral and serve gracefully upon network no-fill. They are never misrepresented as third-party ad impressions.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 4. AD FORMATS MATRIX */}
          <Card>
            <CardHeader title="4. Ad Formats (Simple ON / OFF)" />
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500">
                Enable only formats supported by your selected configuration. Formats not supported by active demand sources are automatically flagged.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { id: 'banner', label: 'Banner Ad', state: fmtBanner, set: setFmtBanner },
                  { id: 'native', label: 'Native Ad', state: fmtNative, set: setFmtNative },
                  { id: 'interstitial', label: 'Interstitial Ad', state: fmtInterstitial, set: setFmtInterstitial },
                  { id: 'rewarded', label: 'Rewarded Ad', state: fmtRewarded, set: setFmtRewarded },
                  { id: 'appOpen', label: 'App Open Ad', state: fmtAppOpen, set: setFmtAppOpen },
                  { id: 'rewardedInterstitial', label: 'Rewarded Interstitial', state: fmtRewardedInterstitial, set: setFmtRewardedInterstitial },
                ].map((fmt) => {
                  const supported = isFormatSupported(fmt.id);
                  return (
                    <label
                      key={fmt.id}
                      className={`flex items-center justify-between p-3.5 rounded-lg border transition-colors ${
                        !supported
                          ? 'border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/40 opacity-50 cursor-not-allowed'
                          : fmt.state
                          ? 'border-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-950/20 cursor-pointer'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 opacity-70 cursor-pointer'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                          {fmt.label}
                        </span>
                        {!supported && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 block mt-0.5">
                            Unsupported by selected source
                          </span>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={supported && fmt.state}
                        disabled={!supported}
                        onChange={(e) => fmt.set(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                      />
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 5. LIVE EFFECTIVE CONFIGURATION PREVIEW */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm font-semibold">5. Live Effective Configuration Preview</CardTitle>
                <p className="text-xs text-slate-500">
                  Calculated payload that <code>wap_ads_sdk</code> receives dynamically for {app.name}.
                </p>
              </div>
              <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-400 text-xs font-mono">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Zero Secrets Exposed
              </Badge>
            </CardHeader>
            <CardContent>
              <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-4 text-[11px] font-mono text-emerald-400">
                {JSON.stringify(
                  {
                    appId: app.id,
                    mediationEngine: 'applovin_max',
                    adsEnabled,
                    environment: adsEnvironment,
                    testMode: adsEnvironment === 'testing',
                    strategy: adStrategy,
                    singleSourceNetwork: adStrategy === 'single_source' ? singleSourceNetwork : undefined,
                    bundledAdapters,
                    enabledFormats: {
                      banner: fmtBanner,
                      native: fmtNative && isFormatSupported('native'),
                      interstitial: fmtInterstitial,
                      rewarded: fmtRewarded,
                      appOpen: fmtAppOpen && isFormatSupported('appOpen'),
                      rewardedInterstitial: fmtRewardedInterstitial && isFormatSupported('rewardedInterstitial'),
                    },
                    demandSources: {
                      applovin: { enabled: netApplovin, status: getDemandSourceStatus('applovin') },
                      admob: { enabled: netAdmob, status: getDemandSourceStatus('admob') },
                      meta: { enabled: netMeta, status: getDemandSourceStatus('meta') },
                      inmobi: { enabled: netInmobi, status: getDemandSourceStatus('inmobi') },
                      unity: { enabled: netUnity, status: getDemandSourceStatus('unity') },
                      wapCustomAds: { enabled: netCustomAds, status: 'configured' },
                    },
                  },
                  null,
                  2,
                )}
              </pre>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="submit" disabled={isSavingAds || !hasRole('editor')} className="px-6">
              <Save className="h-4 w-4 mr-1.5" />
              {isSavingAds ? 'Saving...' : 'Save Ads Configuration'}
            </Button>
          </div>
        </form>
      )}

      {/* ========================================================
          TAB 3: NOTIFICATIONS
          ======================================================== */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Send Notification Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader title={`Send Push Notification to ${app.name}`} />
                <CardContent>
                  <form onSubmit={handleSendNotification} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Notification Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={notifTitle}
                        onChange={(e) => setNotifTitle(e.target.value)}
                        placeholder="e.g. Important Security Update"
                        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Message Body *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={notifMessage}
                        onChange={(e) => setNotifMessage(e.target.value)}
                        placeholder="Tap to open your updated files..."
                        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Category
                        </label>
                        <select
                          value={notifCategory}
                          onChange={(e) => setNotifCategory(e.target.value as any)}
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                        >
                          <option value="SYSTEM">SYSTEM</option>
                          <option value="IMPORTANT">IMPORTANT</option>
                          <option value="UPDATE">UPDATE</option>
                          <option value="FEATURE">FEATURE</option>
                          <option value="PROMOTION">PROMOTION</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Deep Link (Optional)
                        </label>
                        <input
                          type="text"
                          value={notifDeepLink}
                          onChange={(e) => setNotifDeepLink(e.target.value)}
                          placeholder={`${app.packageId}://action`}
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Image URL (Optional)
                      </label>
                      <input
                        type="url"
                        value={notifImageUrl}
                        onChange={(e) => setNotifImageUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="sendNowCheckbox"
                        checked={notifSendNow}
                        onChange={(e) => setNotifSendNow(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="sendNowCheckbox" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Dispatch immediately via FCM to all {app.name} registered devices
                      </label>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button type="submit" disabled={isSendingNotif || !hasRole('editor')}>
                        <Send className="h-4 w-4 mr-1.5" />
                        {isSendingNotif ? 'Sending...' : notifSendNow ? 'Send Push Notification' : 'Save as Draft'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Lockscreen Preview */}
            <div>
              <Card>
                <CardHeader title="Device Notification Preview" />
                <CardContent className="flex flex-col items-center">
                  <div className="w-64 rounded-3xl border-4 border-slate-800 bg-slate-900 p-3 shadow-2xl text-white">
                    <div className="mx-auto h-3 w-20 rounded-full bg-slate-800 mb-3" />
                    <div className="rounded-xl bg-slate-800/90 p-3 backdrop-blur shadow-lg border border-slate-700">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className="h-4 w-4 rounded-full bg-indigo-500 flex items-center justify-center text-[8px] font-bold">
                            {app.name.charAt(0)}
                          </div>
                          <span className="text-[10px] font-bold text-slate-300">{app.name}</span>
                        </div>
                        <span className="text-[9px] text-slate-400">now</span>
                      </div>
                      <p className="text-xs font-bold text-white leading-tight">
                        {notifTitle || 'Notification Title'}
                      </p>
                      <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">
                        {notifMessage || 'Notification message will appear here on user lock screen.'}
                      </p>
                      {notifImageUrl && (
                        <div className="mt-2 h-16 w-full rounded bg-slate-700 overflow-hidden">
                          <img src={notifImageUrl} alt="preview" className="h-full w-full object-cover" />
                        </div>
                      )}
                    </div>
                    <div className="mt-20 text-center">
                      <p className="text-[10px] text-slate-500 font-mono">{app.packageId}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* App Notification History */}
          <Card>
            <CardHeader title={`Notification History for ${app.name} (${appNotifications.length})`} />
            <CardContent>
              {appNotifications.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No notifications recorded for this application yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {appNotifications.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">{n.title}</span>
                          <Badge variant="secondary" className="text-[10px]">{n.category}</Badge>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                            n.status === 'sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {n.status}
                          </span>
                        </div>
                        <p className="text-slate-500 line-clamp-1">{n.message}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Created: {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right font-mono text-[11px] text-slate-500">
                          <span>{n.stats?.delivered || 0} delivered</span>
                          <span className="mx-1">•</span>
                          <span>{n.stats?.opened || 0} opened</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Official Ad Testing Configuration Modal */}
      {activeTestGuideModal && (
        <Modal
          isOpen={Boolean(activeTestGuideModal)}
          onClose={() => setActiveTestGuideModal(null)}
          title={`${activeTestGuideModal.providerName} — ${activeTestGuideModal.formatLabel} Testing Guide`}
          description="Official provider testing procedures, sample identifiers, and verification instructions."
          className="max-w-2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <a
                href={activeTestGuideModal.documentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>View Official Documentation</span>
              </a>
              <Button variant="secondary" onClick={() => setActiveTestGuideModal(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Status & Method Summary */}
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Testing Method:</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  {activeTestGuideModal.testingMethod}
                </span>
              </div>
              <div>
                <p className="text-slate-600 dark:text-slate-400">
                  {activeTestGuideModal.statusDescription}
                </p>
              </div>
            </div>

            {/* Official Test Identifiers */}
            {(activeTestGuideModal.androidSampleId || activeTestGuideModal.iosSampleId) && (
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                  Official Universal Sample Ad Unit IDs
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeTestGuideModal.androidSampleId && (
                    <div className="p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-300">Android Sample ID</span>
                        <button
                          type="button"
                          onClick={() => handleCopyTestId(activeTestGuideModal.androidSampleId!)}
                          className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {copiedTestId === activeTestGuideModal.androidSampleId ? (
                            <><Check className="h-3 w-3 text-emerald-600" /><span className="text-emerald-600 font-bold">Copied</span></>
                          ) : (
                            <><Copy className="h-3 w-3" /><span>Copy</span></>
                          )}
                        </button>
                      </div>
                      <code className="block font-mono text-[10px] text-slate-800 dark:text-slate-200 break-all select-all">
                        {activeTestGuideModal.androidSampleId}
                      </code>
                    </div>
                  )}

                  {activeTestGuideModal.iosSampleId && (
                    <div className="p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-300">iOS Sample ID</span>
                        <button
                          type="button"
                          onClick={() => handleCopyTestId(activeTestGuideModal.iosSampleId!)}
                          className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {copiedTestId === activeTestGuideModal.iosSampleId ? (
                            <><Check className="h-3 w-3 text-emerald-600" /><span className="text-emerald-600 font-bold">Copied</span></>
                          ) : (
                            <><Copy className="h-3 w-3" /><span>Copy</span></>
                          )}
                        </button>
                      </div>
                      <code className="block font-mono text-[10px] text-slate-800 dark:text-slate-200 break-all select-all">
                        {activeTestGuideModal.iosSampleId}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Provider Implementation Guidelines */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Testing Instructions & Verification
              </h4>
              {activeTestGuideModal.providerId === 'applovin' && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 space-y-2">
                  <p className="text-slate-700 dark:text-slate-300">
                    <strong>AppLovin MAX Testing Workflow:</strong>
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-600 dark:text-slate-400">
                    <li>MAX uses your app's configured MAX Ad Unit ID in both testing and production modes. Universal fake IDs are not used.</li>
                    <li>Register your test device (GAID on Android or IDFA on iOS) in <strong>AppLovin Dashboard &gt; MAX &gt; Mediation &gt; Test Mode</strong>.</li>
                    <li>Or launch the MAX Mediation Debugger in your app debug build to verify adapter integration and network test mode:</li>
                  </ol>
                  <div className="bg-slate-950 text-slate-100 font-mono text-[11px] p-2.5 rounded overflow-x-auto">
                    <code>
                      {`// Flutter MAX Mediation Debugger\nimport 'package:applovin_max/applovin_max.dart';\n\nAppLovinMAX.showMediationDebugger();`}
                    </code>
                  </div>
                </div>
              )}

              {activeTestGuideModal.providerId === 'admob' && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 space-y-2">
                  <p className="text-slate-700 dark:text-slate-300">
                    <strong>Google AdMob Testing Workflow:</strong>
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Google Mobile Ads SDK provides official public sample ad unit IDs. When Central Testing Mode is active in WAPCentral, these sample IDs are automatically returned. AdMob test ads always render an explicit "Test Ad" label.
                  </p>
                  <div className="bg-slate-950 text-slate-100 font-mono text-[11px] p-2.5 rounded overflow-x-auto">
                    <code>
                      {`// Flutter Google Mobile Ads Test Request\nfinal banner = BannerAd(\n  size: AdSize.banner,\n  adUnitId: '${testPlatform === 'ios' ? activeTestGuideModal.iosSampleId || ADMOB_OFFICIAL_TEST_IDS.ios.bannerAdaptive : activeTestGuideModal.androidSampleId || ADMOB_OFFICIAL_TEST_IDS.android.bannerAdaptive}',\n  request: const AdRequest(),\n  listener: const BannerAdListener(),\n);\nawait banner.load();`}
                    </code>
                  </div>
                </div>
              )}

              {activeTestGuideModal.providerId === 'meta' && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 space-y-2">
                  <p className="text-slate-700 dark:text-slate-300">
                    <strong>Meta Audience Network Testing:</strong>
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Meta Audience Network test ads are delivered via AppLovin MAX adapter. To receive test ads on your physical device, add your device's hashed ID in Meta Business Manager / Monetization Manager under <strong>Testing</strong>, or enable MAX test mode with Meta demand selected.
                  </p>
                </div>
              )}

              {activeTestGuideModal.providerId === 'inmobi' && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 space-y-2">
                  <p className="text-slate-700 dark:text-slate-300">
                    <strong>InMobi Testing Workflow:</strong>
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    InMobi does not provide universal sample ad unit IDs. Developers must enter their actual InMobi Account ID and Placement IDs, then toggle <strong>Test Mode: ON</strong> in the InMobi Publisher Portal for the placement. Ads can then be verified through the MAX Mediation Debugger.
                  </p>
                </div>
              )}

              {activeTestGuideModal.providerId === 'unity' && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 space-y-2">
                  <p className="text-slate-700 dark:text-slate-300">
                    <strong>Unity Ads Testing Workflow:</strong>
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Unity Ads requires entering your real Unity Game ID and Placement IDs. In the Unity Cloud Dashboard, navigate to <strong>Monetization &gt; Testing</strong> and enable <strong>Test Mode</strong>. Test ads will display a prominent "Unity Ads Test Mode" watermark.
                  </p>
                </div>
              )}

              {activeTestGuideModal.providerId === 'custom_ads' && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 space-y-2">
                  <p className="text-slate-700 dark:text-slate-300">
                    <strong>WebAppyPie Custom House Ads:</strong>
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Managed natively by WAPCentral. In testing mode, standard promotional campaigns for WebAppyPie internal apps are delivered without third-party SDK dependencies or external network fees.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
