import React, { useState, useEffect } from 'react';
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
  ErrorState,
  Modal,
} from '@wapcentral/ui';
import {
  Smartphone,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Save,
  Key,
  Copy,
  RefreshCw,
  Download,
  Loader2,
  Check,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import type { App, AppModule } from '@wapcentral/types';
import {
  subscribeApp,
  updateApp,
  regenerateAppKey,
  downloadAppIntegrationGuide,
} from '../services/appsService.js';

const AVAILABLE_SERVICES: { id: AppModule; label: string; desc: string }[] = [
  { id: 'ads', label: 'Monetization & Ads', desc: 'AppLovin MAX mediation & demand sources' },
  { id: 'notifications', label: 'Push Notifications', desc: 'FCM push campaigns and in-app alerts' },
  { id: 'promotion', label: 'Cross-Promotion', desc: 'In-house promotional campaigns & sponsored native placement' },
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

  const [app, setApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Success / Error alerts
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Credentials state & actions
  const [showAppKey, setShowAppKey] = useState(false);
  const [copiedField, setCopiedField] = useState<'appId' | 'appKey' | null>(null);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [isDownloadingGuide, setIsDownloadingGuide] = useState(false);

  // Form State
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
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubApp();
  }, [appId]);

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

  const toggleModule = (mod: AppModule) => {
    setGenModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  };

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
          <ArrowLeft className="h-4 w-4" /> Back to Applications
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
        description={`Identity, Firebase configuration, credentials, and enabled platform services for ${app.packageId}.`}
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

      {/* APPLICATION CREDENTIALS & DEVELOPER RESOURCES */}
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
                    Platform API &amp; SDK Auth
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
                <span>Confirm &amp; Invalidate Previous Key</span>
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

      {/* APPLICATION CONFIGURATION FORM */}
      <form onSubmit={handleSaveGeneral} className="space-y-6">
        <Card>
          <CardHeader title="Application Identity &amp; Platform" />
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
                  placeholder="https://play.google.com/store/apps/details?id=..."
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
          <CardHeader title="Firebase &amp; Push Services Configuration" />
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
          <CardHeader title="Enabled WAPCentral Services &amp; Modules" />
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
            {isSavingGeneral ? 'Saving...' : 'Save Application Configuration'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ApplicationDetailPage;
