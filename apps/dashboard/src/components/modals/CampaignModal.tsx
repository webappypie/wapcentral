import React, { useState, useEffect } from 'react';
import { Modal, Button } from '@wapcentral/ui';
import type { Campaign, App, LayoutVariant } from '@wapcentral/types';
import { CreateCampaignSchema, type CreateCampaignInput } from '@wapcentral/validation';
import { DevicePreview } from '../DevicePreview.js';

export interface CampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCampaignInput) => Promise<void>;
  initialCampaign?: Campaign | null;
  apps: App[];
}

export const CampaignModal: React.FC<CampaignModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialCampaign,
  apps,
}) => {
  const [name, setName] = useState('');
  const [promotedAppId, setPromotedAppId] = useState('');
  const [targetAppIds, setTargetAppIds] = useState<string[]>([]);
  const [layoutVariant, setLayoutVariant] = useState<LayoutVariant>('banner');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ctaText, setCtaText] = useState('Install Free');
  const [storeUrl, setStoreUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [priority, setPriority] = useState<number>(50);
  const [maxImpressions, setMaxImpressions] = useState<number>(3);
  const [periodHours, setPeriodHours] = useState<number>(24);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialCampaign) {
      setName(initialCampaign.name);
      setPromotedAppId(initialCampaign.promotedAppId);
      setTargetAppIds(initialCampaign.targetAppIds);
      setLayoutVariant(initialCampaign.layoutVariant);
      setTitle(initialCampaign.title);
      setDescription(initialCampaign.description);
      setCtaText(initialCampaign.ctaText);
      setStoreUrl(initialCampaign.storeUrl);
      setImageUrl(initialCampaign.imageUrl || '');
      setPriority(initialCampaign.priority ?? 50);
      setMaxImpressions(initialCampaign.frequencyCap?.maxImpressions ?? 3);
      setPeriodHours(initialCampaign.frequencyCap?.periodHours ?? 24);
    } else {
      setName('');
      setPromotedAppId(apps[0]?.id || 'app_01');
      setTargetAppIds(apps.map((a) => a.id));
      setLayoutVariant('banner');
      setTitle('Unlock Premium Features');
      setDescription('Get instant access to advanced productivity tools.');
      setCtaText('Get Started');
      setStoreUrl('https://play.google.com/store/apps');
      setImageUrl(
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60',
      );
      setPriority(50);
      setMaxImpressions(3);
      setPeriodHours(24);
    }
    setErrors({});
  }, [initialCampaign, isOpen, apps]);

  const toggleTargetApp = (appId: string) => {
    setTargetAppIds((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const payload: Record<string, unknown> = {
      name: name.trim(),
      promotedAppId,
      targetAppIds,
      layoutVariant,
      title: title.trim(),
      description: description.trim(),
      ctaText: ctaText.trim(),
      storeUrl: storeUrl.trim(),
      priority,
      frequencyCap: {
        maxImpressions,
        periodHours,
      },
    };

    if (imageUrl.trim()) {
      payload.imageUrl = imageUrl.trim();
    }

    const validationResult = CreateCampaignSchema.safeParse(payload);
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
      const message = err instanceof Error ? err.message : 'Failed to save campaign';
      setErrors({ general: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const targetAppNames = apps
    .filter((a) => targetAppIds.includes(a.id))
    .map((a) => a.name)
    .join(', ');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialCampaign ? 'Edit Campaign' : 'Create Promotion Campaign'}
      description="Design creative assets, define targeting, and preview rendering live on mobile devices."
      className="max-w-5xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            {initialCampaign ? 'Save Changes' : 'Create Campaign'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[75vh] overflow-y-auto pr-1">
        {/* Left Column: Form Controls (7 cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-4">
          {errors.general && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-500">
              {errors.general}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Campaign Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Promo - Notes AI Cross-sell"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Promoted App *
              </label>
              <select
                value={promotedAppId}
                onChange={(e) => setPromotedAppId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.platform})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Ad Placement / Layout *
              </label>
              <select
                value={layoutVariant}
                onChange={(e) => setLayoutVariant(e.target.value as LayoutVariant)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="banner">Docked Banner (Top/Bottom)</option>
                <option value="interstitial">Fullscreen Interstitial</option>
                <option value="native">Native In-Feed Card</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Target Hosting Apps (Where to display) *
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {apps.map((a) => {
                const isSelected = targetAppIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleTargetApp(a.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {a.name}
                  </button>
                );
              })}
            </div>
            {errors.targetAppIds && (
              <p className="mt-1 text-xs text-rose-500">{errors.targetAppIds}</p>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
              Creative Assets
            </h4>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Headline / Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Try WAP Notes AI Free"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {errors.title && <p className="mt-1 text-xs text-rose-500">{errors.title}</p>}
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Body Description / Subheadline *
                </label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summarize audio meetings and convert notes to flashcards"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-rose-500">{errors.description}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    Call To Action (CTA Text) *
                  </label>
                  <input
                    type="text"
                    required
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="Install Free"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {errors.ctaText && <p className="mt-1 text-xs text-rose-500">{errors.ctaText}</p>}
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    Creative Image URL
                  </label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {errors.imageUrl && (
                    <p className="mt-1 text-xs text-rose-500">{errors.imageUrl}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Destination Store URL *
                </label>
                <input
                  type="url"
                  required
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  placeholder="https://play.google.com/store/apps/details?id=..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {errors.storeUrl && <p className="mt-1 text-xs text-rose-500">{errors.storeUrl}</p>}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
              Delivery Controls & Capping
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Priority (0-100)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Max Impressions
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxImpressions}
                  onChange={(e) => setMaxImpressions(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Window (Hours)
                </label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={periodHours}
                  onChange={(e) => setPeriodHours(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Right Column: Interactive Phone Preview (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
          <DevicePreview
            layoutVariant={layoutVariant}
            title={title}
            description={description}
            ctaText={ctaText}
            imageUrl={imageUrl}
            storeUrl={storeUrl}
            appName={apps.find((a) => a.id === promotedAppId)?.name || 'Preview App'}
          />
          {targetAppNames && (
            <p className="mt-2 text-[11px] text-slate-500 text-center">
              Active in: <span className="font-semibold text-slate-400">{targetAppNames}</span>
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
