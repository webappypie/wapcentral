import React, { useState, useEffect } from 'react';
import { Modal, Button } from '@wapcentral/ui';
import type { App, Platform, Environment, AppModule } from '@wapcentral/types';
import { CreateAppSchema, type CreateAppInput } from '@wapcentral/validation';

export interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAppInput) => Promise<void>;
  initialApp?: App | null;
}

const AVAILABLE_MODULES: { id: AppModule; label: string; description: string }[] = [
  { id: 'promotion', label: 'Cross-Promotion', description: 'Enable in-house promo campaigns' },
  { id: 'ads', label: 'External Ads', description: 'AdMob, Meta, and AppLovin mediation' },
  { id: 'ai', label: 'AI Gateway', description: 'Access backend LLM & multimodal policies' },
  { id: 'analytics', label: 'Analytics', description: 'Collect usage & event metrics' },
  { id: 'health', label: 'Health Monitoring', description: 'Track uptime and error rates' },
];

export const AppModal: React.FC<AppModalProps> = ({ isOpen, onClose, onSubmit, initialApp }) => {
  const [name, setName] = useState('');
  const [packageId, setPackageId] = useState('');
  const [bundleId, setBundleId] = useState('');
  const [platform, setPlatform] = useState<Platform>('android');
  const [version, setVersion] = useState('1.0.0');
  const [environment, setEnvironment] = useState<Environment>('production');
  const [storeUrlAndroid, setStoreUrlAndroid] = useState('');
  const [storeUrlIos, setStoreUrlIos] = useState('');
  const [enabledModules, setEnabledModules] = useState<AppModule[]>(['promotion', 'ads']);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setEnabledModules(initialApp.enabledModules || ['promotion']);
    } else {
      setName('');
      setPackageId('');
      setBundleId('');
      setPlatform('android');
      setVersion('1.0.0');
      setEnvironment('production');
      setStoreUrlAndroid('');
      setStoreUrlIos('');
      setEnabledModules(['promotion', 'ads']);
    }
    setErrors({});
  }, [initialApp, isOpen]);

  const toggleModule = (mod: AppModule) => {
    setEnabledModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
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

    if (bundleId.trim()) payload.bundleId = bundleId.trim();

    const storeUrl: { android?: string; ios?: string } = {};
    if (storeUrlAndroid.trim()) storeUrl.android = storeUrlAndroid.trim();
    if (storeUrlIos.trim()) storeUrl.ios = storeUrlIos.trim();
    if (Object.keys(storeUrl).length > 0) payload.storeUrl = storeUrl;

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
      await onSubmit(validationResult.data);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save application';
      setErrors({ general: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
