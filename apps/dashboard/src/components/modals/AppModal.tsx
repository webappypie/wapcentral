import React, { useState, useEffect } from 'react';
import { Modal, Button } from '@wapcentral/ui';
import { CheckCircle2, Key, Copy, Check, Eye, EyeOff } from 'lucide-react';
import type { App, Platform, Environment, AppModule } from '@wapcentral/types';
import { CreateAppSchema, type CreateAppInput } from '@wapcentral/validation';

export interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAppInput) => Promise<App | void>;
  initialApp?: App | null;
  onNavigateToDetail?: (appId: string) => void;
}

const AVAILABLE_MODULES: { id: AppModule; label: string; description: string }[] = [
  { id: 'promotion', label: 'Cross-Promotion', description: 'Enable in-house promo campaigns' },
  { id: 'ads', label: 'External Ads', description: 'AdMob, Meta, and AppLovin mediation' },
  { id: 'notifications', label: 'Push Notifications', description: 'Enable FCM push & in-app notifications' },
  { id: 'ai', label: 'AI Gateway', description: 'Access backend LLM & multimodal policies' },
  { id: 'analytics', label: 'Analytics', description: 'Collect usage & event metrics' },
  { id: 'health', label: 'Health Monitoring', description: 'Track uptime and error rates' },
];

export const AppModal: React.FC<AppModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialApp,
  onNavigateToDetail,
}) => {
  const [name, setName] = useState('');
  const [packageId, setPackageId] = useState('');
  const [bundleId, setBundleId] = useState('');
  const [platform, setPlatform] = useState<Platform>('android');
  const [version, setVersion] = useState('1.0.0');
  const [environment, setEnvironment] = useState<Environment>('production');
  const [storeUrlAndroid, setStoreUrlAndroid] = useState('');
  const [storeUrlIos, setStoreUrlIos] = useState('');
  const [firebaseProjectId, setFirebaseProjectId] = useState('');
  const [firebaseAndroidAppId, setFirebaseAndroidAppId] = useState('');
  const [firebaseIosAppId, setFirebaseIosAppId] = useState('');
  const [fcmSenderId, setFcmSenderId] = useState('');
  const [enabledModules, setEnabledModules] = useState<AppModule[]>(['promotion', 'ads', 'notifications']);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success screen state after creating new app
  const [createdApp, setCreatedApp] = useState<App | null>(null);
  const [showCreatedKey, setShowCreatedKey] = useState(false);
  const [copiedField, setCopiedField] = useState<'appId' | 'appKey' | null>(null);

  useEffect(() => {
    if (initialApp) {
      setName(initialApp.name);
      setPackageId(initialApp.packageId);
      setBundleId(initialApp.bundleId || '');
      setPlatform(initialApp.platform);
      setVersion(initialApp.version);
      setEnvironment(initialApp.environment);
      setStoreUrlAndroid(initialApp.storeUrl?.android || '');
      setStoreUrlIos(initialApp.storeUrl?.ios || '');
      setFirebaseProjectId(initialApp.firebaseProjectId || '');
      setFirebaseAndroidAppId(initialApp.firebaseAndroidAppId || '');
      setFirebaseIosAppId(initialApp.firebaseIosAppId || '');
      setFcmSenderId(initialApp.fcmSenderId || '');
      setEnabledModules(initialApp.enabledModules || ['promotion', 'ads', 'notifications']);
    } else {
      setName('');
      setPackageId('');
      setBundleId('');
      setPlatform('android');
      setVersion('1.0.0');
      setEnvironment('production');
      setStoreUrlAndroid('');
      setStoreUrlIos('');
      setFirebaseProjectId('');
      setFirebaseAndroidAppId('');
      setFirebaseIosAppId('');
      setFcmSenderId('');
      setEnabledModules(['promotion', 'ads', 'notifications']);
    }
    setErrors({});
  }, [initialApp, isOpen]);

  const toggleModule = (mod: AppModule) => {
    setEnabledModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
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

  const handleModalClose = () => {
    setCreatedApp(null);
    setShowCreatedKey(false);
    setCopiedField(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const payload: Record<string, unknown> = {
      name: name.trim(),
      packageId: packageId.trim(),
      platform,
      version: version.trim(),
      environment,
      enabledModules,
    };

    if (bundleId.trim()) {
      payload.bundleId = bundleId.trim();
    } else if (initialApp?.bundleId) {
      payload.bundleId = null;
    }

    if (firebaseProjectId.trim()) {
      payload.firebaseProjectId = firebaseProjectId.trim();
    } else if (initialApp?.firebaseProjectId) {
      payload.firebaseProjectId = null;
    }

    if (firebaseAndroidAppId.trim()) {
      payload.firebaseAndroidAppId = firebaseAndroidAppId.trim();
    } else if (initialApp?.firebaseAndroidAppId) {
      payload.firebaseAndroidAppId = null;
    }

    if (firebaseIosAppId.trim()) {
      payload.firebaseIosAppId = firebaseIosAppId.trim();
    } else if (initialApp?.firebaseIosAppId) {
      payload.firebaseIosAppId = null;
    }

    if (fcmSenderId.trim()) {
      payload.fcmSenderId = fcmSenderId.trim();
    } else if (initialApp?.fcmSenderId) {
      payload.fcmSenderId = null;
    }

    const storeUrl: { android?: string; ios?: string } = {};
    if (storeUrlAndroid.trim()) storeUrl.android = storeUrlAndroid.trim();
    if (storeUrlIos.trim()) storeUrl.ios = storeUrlIos.trim();
    if (Object.keys(storeUrl).length > 0) {
      payload.storeUrl = storeUrl;
    } else if (initialApp?.storeUrl) {
      payload.storeUrl = null;
    }

    const validationResult = CreateAppSchema.safeParse(payload);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validationResult.error.issues) {
        const fieldName = issue.path[0] ? String(issue.path[0]) : 'general';
        fieldErrors[fieldName] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await onSubmit(validationResult.data);
      if (!initialApp && res && typeof res === 'object' && 'id' in res) {
        setCreatedApp(res as App);
        setShowCreatedKey(false);
      } else {
        onClose();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save application';
      setErrors({ general: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdApp) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleModalClose}
        title="Application Created Successfully"
        description={`WAPCentral registration record created for ${createdApp.name}.`}
        className="max-w-lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-slate-500">
              Save key securely before closing.
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleModalClose}>
                Done
              </Button>
              {onNavigateToDetail && (
                <Button
                  variant="primary"
                  onClick={() => {
                    const targetId = createdApp.id;
                    handleModalClose();
                    onNavigateToDetail(targetId);
                  }}
                >
                  View App Detail
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4 py-1 text-xs">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/40 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-950 dark:text-emerald-200">
                Application Registered & Authorized
              </p>
              <p className="text-emerald-800 dark:text-emerald-300 mt-0.5">
                Save this App Key securely. Pass via <code className="font-mono font-bold">X-App-Id</code> and <code className="font-mono font-bold">X-App-Key</code> headers in your mobile app SDK initialization.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/70 space-y-3.5">
            {/* App ID */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  App ID
                </span>
                <span className="text-[10px] font-mono text-slate-500">Header: X-App-Id</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <span className="truncate select-all">{createdApp.id}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(createdApp.id, 'appId')}
                  className="h-6 px-2 text-[11px] flex items-center gap-1"
                >
                  {copiedField === 'appId' ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* X-App-Key */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  X-App-Key
                </span>
                <span className="text-[10px] font-mono text-slate-500">Header: X-App-Key</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <span className="truncate select-all text-slate-700 dark:text-slate-300">
                  {showCreatedKey ? createdApp.appKey : '••••••••••••••••••••••••'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowCreatedKey(!showCreatedKey)}
                    className="h-6 px-1.5 text-[11px]"
                  >
                    {showCreatedKey ? 'Hide' : 'Show'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(createdApp.appKey || '', 'appKey')}
                    className="h-6 px-2 text-[11px] flex items-center gap-1"
                  >
                    {copiedField === 'appKey' ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300">
            <strong>Security Reminder:</strong> Never commit your App Key to public version control or expose it in unauthenticated browser client bundles.
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title={initialApp ? 'Edit Application' : 'Register New Application'}
      description="Configure app credentials, package metadata, and enabled SDK modules."
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            {initialApp ? 'Save Changes' : 'Register App'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {errors.general && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-500">
            {errors.general}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              App Display Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. WebAppyPie Reader"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Platform *
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="android">Android</option>
              <option value="ios">iOS</option>
              <option value="web">Web</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Package ID *
            </label>
            <input
              type="text"
              required
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              placeholder="com.webappypie.appname"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {errors.packageId && <p className="mt-1 text-xs text-rose-500">{errors.packageId}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              iOS Bundle ID (Optional)
            </label>
            <input
              type="text"
              value={bundleId}
              onChange={(e) => setBundleId(e.target.value)}
              placeholder="com.webappypie.appname.ios"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Version *
            </label>
            <input
              type="text"
              required
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {errors.version && <p className="mt-1 text-xs text-rose-500">{errors.version}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Environment *
            </label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as Environment)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
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
              value={storeUrlAndroid}
              onChange={(e) => setStoreUrlAndroid(e.target.value)}
              placeholder="https://play.google.com/store/apps/..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Apple App Store URL
            </label>
            <input
              type="url"
              value={storeUrlIos}
              onChange={(e) => setStoreUrlIos(e.target.value)}
              placeholder="https://apps.apple.com/app/..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Firebase & Push Credentials
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Firebase Project ID
              </label>
              <input
                type="text"
                value={firebaseProjectId}
                onChange={(e) => setFirebaseProjectId(e.target.value)}
                placeholder="e.g. filezen-app"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                FCM Sender ID
              </label>
              <input
                type="text"
                value={fcmSenderId}
                onChange={(e) => setFcmSenderId(e.target.value)}
                placeholder="e.g. 109283746501"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Firebase Android App ID
              </label>
              <input
                type="text"
                value={firebaseAndroidAppId}
                onChange={(e) => setFirebaseAndroidAppId(e.target.value)}
                placeholder="1:109283746501:android:abc12345"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Firebase iOS App ID
              </label>
              <input
                type="text"
                value={firebaseIosAppId}
                onChange={(e) => setFirebaseIosAppId(e.target.value)}
                placeholder="1:109283746501:ios:abc12345"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Enabled SDK Modules
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AVAILABLE_MODULES.map((mod) => {
              const isChecked = enabledModules.includes(mod.id);
              return (
                <label
                  key={mod.id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    isChecked
                      ? 'border-brand-500/50 bg-brand-50/50 dark:bg-brand-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleModule(mod.id)}
                    className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                      {mod.label}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-tight">
                      {mod.description}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </form>
    </Modal>
  );
};
