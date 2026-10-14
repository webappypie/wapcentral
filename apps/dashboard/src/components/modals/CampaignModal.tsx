import React, { useState, useEffect } from 'react';
import { Modal, Button } from '@wapcentral/ui';
import type { Campaign, App, LayoutVariant } from '@wapcentral/types';
import { CreateCampaignSchema, type CreateCampaignInput } from '@wapcentral/validation';
import { DevicePreview } from '../DevicePreview.js';
import type { LucideIcon } from 'lucide-react';
import {
  Sparkles,
  Layout,
  Layers,
  Maximize2,
  Check,
  ExternalLink,
  Upload,
  Image as ImageIcon,
  Trash2,
  Sliders,
  Clock,
  AlertCircle,
  Smartphone,
  ChevronRight,
  Info,
} from 'lucide-react';

export interface CampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCampaignInput) => Promise<void>;
  initialCampaign?: Campaign | null;
  apps: App[];
}

const CTA_PRESETS = [
  'Install Free',
  'Get Started',
  'Try Now',
  'Claim Offer',
  'Upgrade to Pro',
  'Learn More',
];

const PLACEMENT_OPTIONS: Array<{
  value: LayoutVariant;
  label: string;
  badge: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    value: 'sponsored',
    label: 'Sponsored Home',
    badge: 'Native 120dp',
    description: 'Home screen native banner with clear sponsored header',
    icon: Sparkles,
  },
  {
    value: 'banner',
    label: 'Docked Banner',
    badge: 'Banner',
    description: 'Floating dock positioned at the top or bottom of the screen',
    icon: Layout,
  },
  {
    value: 'native',
    label: 'Native In-Feed',
    badge: 'Content Card',
    description: 'Rich card placed inside article or feed scroll views',
    icon: Layers,
  },
  {
    value: 'interstitial',
    label: 'Interstitial',
    badge: 'Fullscreen',
    description: 'High-visibility modal takeover between user screen transitions',
    icon: Maximize2,
  },
];

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
  const [layoutVariant, setLayoutVariant] = useState<LayoutVariant>('sponsored');
  const [sponsorLabel, setSponsorLabel] = useState('Sponsored');
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
      setTargetAppIds(initialCampaign.targetAppIds || []);
      setLayoutVariant(initialCampaign.layoutVariant || 'sponsored');
      setSponsorLabel(initialCampaign.sponsorLabel || 'Sponsored');
      setTitle(initialCampaign.title);
      setDescription(initialCampaign.description);
      setCtaText(initialCampaign.ctaText || 'Install Free');
      setStoreUrl(initialCampaign.storeUrl);
      setImageUrl(initialCampaign.imageUrl || '');
      setPriority(initialCampaign.priority ?? 50);
      setMaxImpressions(initialCampaign.frequencyCap?.maxImpressions ?? 3);
      setPeriodHours(initialCampaign.frequencyCap?.periodHours ?? 24);
    } else {
      setName('');
      const defaultApp = apps[0];
      setPromotedAppId(defaultApp?.id || 'app_01');
      setTargetAppIds(apps.map((a) => a.id));
      setLayoutVariant('sponsored');
      setSponsorLabel('Sponsored');
      setTitle('Unlock Premium Productivity');
      setDescription('Experience high-speed cloud sync and advanced AI workflows.');
      setCtaText('Install Free');
      const defaultStoreUrl =
        (defaultApp?.storeUrl && typeof defaultApp.storeUrl === 'object'
          ? defaultApp.storeUrl.android || defaultApp.storeUrl.ios
          : undefined) || 'https://play.google.com/store/apps';
      setStoreUrl(defaultStoreUrl);
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

  const selectAllTargetApps = () => {
    setTargetAppIds(apps.map((a) => a.id));
  };

  const clearTargetApps = () => {
    setTargetAppIds([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, imageUrl: 'Image asset must be under 5MB.' }));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImageUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAutoFillStoreUrl = () => {
    const targetApp = apps.find((a) => a.id === promotedAppId);
    if (targetApp?.storeUrl && typeof targetApp.storeUrl === 'object') {
      const url = targetApp.storeUrl.android || targetApp.storeUrl.ios;
      if (url) {
        setStoreUrl(url);
      }
    }
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

    if (layoutVariant === 'sponsored' || sponsorLabel.trim()) {
      payload.sponsorLabel = sponsorLabel.trim() || 'Sponsored';
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

  const promotedApp = apps.find((a) => a.id === promotedAppId);
  const targetApps = apps.filter((a) => targetAppIds.includes(a.id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialCampaign ? 'Edit Sponsorship Campaign' : 'Create Sponsorship Campaign'}
      description="Configure cross-app promotion, sponsor labels, and preview native mobile rendering in real-time."
      className="max-w-6xl w-full"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Real-time mobile simulation active</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
              {initialCampaign ? 'Save Changes' : 'Publish Campaign'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Controls (7 cols) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 space-y-6 max-h-[72vh] overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
        >
          {errors.general && (
            <div className="flex items-center gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3.5 text-sm text-rose-500">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* Section 1: Campaign Identity & Format */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Campaign Identity & Placement
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-400">Required Step</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Campaign Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q4 Growth Promo - FileZen Cross-sell"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
              />
              {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Promoted App *
                </label>
                <select
                  value={promotedAppId}
                  onChange={(e) => setPromotedAppId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {apps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.platform})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Target application being advertised
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Sponsor Label
                </label>
                <input
                  type="text"
                  value={sponsorLabel}
                  onChange={(e) => setSponsorLabel(e.target.value)}
                  placeholder="Sponsored (default)"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Clear label displayed above creative
                </p>
              </div>
            </div>

            {/* Placement Layout Cards */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Ad Placement Format *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PLACEMENT_OPTIONS.map((opt) => {
                  const isSelected = layoutVariant === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLayoutVariant(opt.value)}
                      className={`relative flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-brand-500 bg-brand-500/5 ring-2 ring-brand-500/20 dark:bg-brand-500/10'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isSelected
                            ? 'bg-brand-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {opt.label}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                              isSelected
                                ? 'bg-brand-500/20 text-brand-600 dark:text-brand-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {opt.description}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="absolute top-3 right-3 text-brand-500">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Hosting Apps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Target Hosting Apps (Where to Display) *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllTargetApps}
                    className="text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={clearTargetApps}
                    className="text-[11px] font-medium text-slate-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {apps.map((a) => {
                  const isSelected = targetAppIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleTargetApp(a.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        isSelected
                          ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300 ring-1 ring-brand-500/30'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-brand-500" />}
                      <span>{a.name}</span>
                      <span className="text-[10px] text-slate-400 uppercase">({a.platform})</span>
                    </button>
                  );
                })}
              </div>
              {errors.targetAppIds && (
                <p className="mt-1.5 text-xs text-rose-500">{errors.targetAppIds}</p>
              )}
            </div>
          </div>

          {/* Section 2: Creative Assets & Copy */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Creative Content & Destination
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-400">Customer Facing</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Headline / Title *
                </label>
                <span className="text-[11px] text-slate-400">{title.length} / 60</span>
              </div>
              <input
                type="text"
                required
                maxLength={60}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Unlock Scientific Functions with OptiLens"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {errors.title && <p className="mt-1 text-xs text-rose-500">{errors.title}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Body Description / Subheadline *
                </label>
                <span className="text-[11px] text-slate-400">{description.length} / 200</span>
              </div>
              <textarea
                required
                rows={2}
                maxLength={200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief, compelling pitch explaining what users gain by installing"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
              {errors.description && (
                <p className="mt-1 text-xs text-rose-500">{errors.description}</p>
              )}
            </div>

            {/* CTA Text with Presets */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Call To Action (CTA Text) *
                </label>
                <span className="text-[11px] text-slate-400">{ctaText.length} / 30</span>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  required
                  maxLength={30}
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="e.g. Install Free"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 mr-1">Presets:</span>
                  {CTA_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCtaText(preset)}
                      className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                        ctaText === preset
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 font-semibold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              {errors.ctaText && <p className="mt-1 text-xs text-rose-500">{errors.ctaText}</p>}
            </div>

            {/* Creative Image Asset with Thumbnail & File Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Creative Image Asset
              </label>
              <div className="flex items-start gap-3">
                {imageUrl ? (
                  <div className="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0">
                    <img src={imageUrl} alt="Creative Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      aria-label="Remove Image"
                      className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-slate-400 shrink-0">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}

                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/... or paste image URL"
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Recommended: 1200x628 (Native/Banner) or 1080x1920 (Interstitial). Max 5MB.
                  </p>
                </div>
              </div>
              {errors.imageUrl && <p className="mt-1 text-xs text-rose-500">{errors.imageUrl}</p>}
            </div>

            {/* Destination Store URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Destination Store URL *
                </label>
                {promotedApp?.storeUrl && (
                  <button
                    type="button"
                    onClick={handleAutoFillStoreUrl}
                    className="text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    Auto-fill from {promotedApp.name}
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="url"
                  required
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  placeholder="https://play.google.com/store/apps/details?id=..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 pr-10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {storeUrl && (
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open Destination Link"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              {errors.storeUrl && <p className="mt-1 text-xs text-rose-500">{errors.storeUrl}</p>}
            </div>
          </div>

          {/* Section 3: Delivery Controls & Pacing */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Sliders className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Pacing & Frequency Capping
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-400">Delivery Controls</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Priority
                  </label>
                  <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                    {priority}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full accent-brand-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400">0 (low) to 100 (urgent)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Max Impressions
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={maxImpressions}
                    onChange={(e) => setMaxImpressions(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    / user
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Time Window
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={periodHours}
                    onChange={(e) => setPeriodHours(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    hours
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-900 p-2.5 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span>
                Each unique user will receive at most {maxImpressions} impressions within any {periodHours}-hour period.
              </span>
            </div>
          </div>
        </form>

        {/* Right Column: Live Interactive Mobile Preview (5 cols) */}
        <div className="lg:col-span-5 sticky top-0 flex flex-col items-center justify-start bg-slate-950/70 rounded-2xl border border-slate-800 p-5 shadow-inner">
          {/* Top Live Stage Header */}
          <div className="flex items-center justify-between w-full mb-4 px-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Live Mobile Preview
              </span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
              {layoutVariant}
            </span>
          </div>

          {/* Interactive Phone Frame */}
          <div className="flex items-center justify-center w-full py-2">
            <DevicePreview
              layoutVariant={layoutVariant}
              title={title}
              description={description}
              ctaText={ctaText}
              imageUrl={imageUrl}
              storeUrl={storeUrl}
              sponsorLabel={sponsorLabel}
              appName={promotedApp?.name || 'Preview App'}
            />
          </div>

          {/* Target Host App Indicator */}
          <div className="w-full mt-4 pt-3 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-400">
              Simulated in: <span className="font-semibold text-slate-200">{promotedApp?.name || 'Preview App'}</span>
            </p>
            {targetApps.length > 0 && (
              <p className="mt-1 text-[10px] text-slate-500 truncate max-w-full">
                Active in: {targetApps.map((a) => a.name).join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
