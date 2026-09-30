import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge } from '@wapcentral/ui';
import { Zap, Plus, Trash2 } from 'lucide-react';
import type { AiPolicy, AiProvider, FallbackEntry } from '@wapcentral/types';
import type { CreateAiPolicyInput, UpdateAiPolicyInput } from '@wapcentral/validation';

export interface AiPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  policy: AiPolicy | null; // null = create
  providers: AiProvider[];
  onSubmit: (
    data: CreateAiPolicyInput | { id: string; data: UpdateAiPolicyInput },
  ) => Promise<void>;
}

export const AiPolicyModal: React.FC<AiPolicyModalProps> = ({
  isOpen,
  onClose,
  policy,
  providers,
  onSubmit,
}) => {
  const isEdit = !!policy;

  const [appId, setAppId] = useState('app_01');
  const [feature, setFeature] = useState('');
  const [primaryProviderId, setPrimaryProviderId] = useState('');
  const [primaryModelId, setPrimaryModelId] = useState('');
  const [fallbackChain, setFallbackChain] = useState<FallbackEntry[]>([]);
  const [dailyRequestLimit, setDailyRequestLimit] = useState<number | undefined>(50000);
  const [dailyTokenLimit, setDailyTokenLimit] = useState<number | undefined>(10000000);
  const [maxInputTokens, setMaxInputTokens] = useState<number | undefined>(8192);
  const [maxOutputTokens, setMaxOutputTokens] = useState<number | undefined>(2048);
  const [enabled, setEnabled] = useState(true);

  // New fallback entry inputs
  const [fbProviderId, setFbProviderId] = useState('');
  const [fbModelId, setFbModelId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (policy) {
      setAppId(policy.appId);
      setFeature(policy.feature);
      setPrimaryProviderId(policy.primaryProviderId);
      setPrimaryModelId(policy.primaryModelId);
      setFallbackChain([...policy.fallbackChain]);
      setDailyRequestLimit(policy.quotas.dailyRequestLimit);
      setDailyTokenLimit(policy.quotas.dailyTokenLimit);
      setMaxInputTokens(policy.quotas.maxInputTokensPerRequest);
      setMaxOutputTokens(policy.quotas.maxOutputTokensPerRequest);
      setEnabled(policy.enabled);
    } else {
      setAppId('app_01');
      setFeature('');
      const defaultProvider = providers[0]?.id || 'gemini';
      setPrimaryProviderId(defaultProvider);
      const defaultModel = providers[0]?.models[0]?.modelId || 'gemini-1.5-flash';
      setPrimaryModelId(defaultModel);
      setFallbackChain([
        {
          providerId: 'openai',
          modelId: 'gpt-4o-mini',
          priority: 1,
        },
      ]);
      setDailyRequestLimit(50000);
      setDailyTokenLimit(10000000);
      setMaxInputTokens(8192);
      setMaxOutputTokens(2048);
      setEnabled(true);
    }
    setError(null);
  }, [policy, isOpen, providers]);

  const handleAddFallback = () => {
    if (!fbProviderId || !fbModelId) return;
    setFallbackChain([
      ...fallbackChain,
      {
        providerId: fbProviderId,
        modelId: fbModelId,
        priority: fallbackChain.length + 1,
      },
    ]);
    setFbProviderId('');
    setFbModelId('');
  };

  const handleRemoveFallback = (index: number) => {
    setFallbackChain(fallbackChain.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feature.trim()) {
      setError('Feature / Intent name is required');
      return;
    }
    if (!primaryProviderId || !primaryModelId) {
      setError('Primary provider and model must be specified');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const quotas = {
        ...(dailyRequestLimit ? { dailyRequestLimit: Number(dailyRequestLimit) } : {}),
        ...(dailyTokenLimit ? { dailyTokenLimit: Number(dailyTokenLimit) } : {}),
        ...(maxInputTokens ? { maxInputTokensPerRequest: Number(maxInputTokens) } : {}),
        ...(maxOutputTokens ? { maxOutputTokensPerRequest: Number(maxOutputTokens) } : {}),
      };

      if (isEdit && policy) {
        await onSubmit({
          id: policy.id,
          data: {
            appId,
            feature: feature.trim(),
            primaryProviderId,
            primaryModelId,
            fallbackChain,
            quotas,
            enabled,
          },
        });
      } else {
        await onSubmit({
          appId,
          feature: feature.trim(),
          primaryProviderId,
          primaryModelId,
          fallbackChain,
          quotas,
          enabled,
        });
      }

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save routing policy');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProvider = providers.find((p) => p.id === primaryProviderId);
  const fbSelectedProvider = providers.find((p) => p.id === fbProviderId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Policy: ${policy.feature}` : 'Create AI Routing Policy'}
      description="Configure model failover chains, rate limits, and token budgets per feature."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            {isEdit ? 'Save Policy' : 'Create Policy'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Target App
            </label>
            <input
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="e.g. app_01 or global"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Feature / Intent Key <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={feature}
              onChange={(e) => setFeature(e.target.value)}
              placeholder="e.g. chat_assistant, image_analysis"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Primary Route */}
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3.5 dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900 dark:text-indigo-300">
            <Zap className="h-4 w-4 text-indigo-600" /> Primary Provider & Model
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Provider
              </label>
              <select
                value={primaryProviderId}
                onChange={(e) => {
                  setPrimaryProviderId(e.target.value);
                  const p = providers.find((pr) => pr.id === e.target.value);
                  if (p?.models[0]) {
                    setPrimaryModelId(p.models[0].modelId);
                  }
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Model
              </label>
              <select
                value={primaryModelId}
                onChange={(e) => setPrimaryModelId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {selectedProvider?.models.map((m) => (
                  <option key={m.id} value={m.modelId}>
                    {m.name} ({m.modelId})
                  </option>
                )) || <option value={primaryModelId}>{primaryModelId}</option>}
              </select>
            </div>
          </div>
        </div>

        {/* Fallback Chain */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Fallback Chain (Circuit Breakers)
          </label>
          <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
            {fallbackChain.map((fb, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800/60"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Tier {fb.priority}</Badge>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {fb.providerId}
                  </span>
                  <span className="font-mono text-slate-500">→ {fb.modelId}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFallback(idx)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {fallbackChain.length === 0 && (
              <p className="py-2 text-center text-xs text-slate-400">
                No fallback providers configured. Request will fail if primary is unavailable.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <select
              value={fbProviderId}
              onChange={(e) => {
                setFbProviderId(e.target.value);
                const p = providers.find((pr) => pr.id === e.target.value);
                if (p?.models[0]) {
                  setFbModelId(p.models[0].modelId);
                }
              }}
              className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Select Fallback Provider...</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              value={fbModelId}
              onChange={(e) => setFbModelId(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Select Model...</option>
              {fbSelectedProvider?.models.map((m) => (
                <option key={m.id} value={m.modelId}>
                  {m.name}
                </option>
              ))}
            </select>

            <Button type="button" size="sm" variant="secondary" onClick={handleAddFallback}>
              <Plus className="mr-1 h-3 w-3" /> Add Fallback
            </Button>
          </div>
        </div>

        {/* Quotas & Token Caps */}
        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
              Daily Request Limit
            </label>
            <input
              type="number"
              value={dailyRequestLimit || ''}
              onChange={(e) => setDailyRequestLimit(Number(e.target.value) || undefined)}
              placeholder="50000"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
              Daily Token Cap
            </label>
            <input
              type="number"
              value={dailyTokenLimit || ''}
              onChange={(e) => setDailyTokenLimit(Number(e.target.value) || undefined)}
              placeholder="10000000"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
              Max Input Tokens / Req
            </label>
            <input
              type="number"
              value={maxInputTokens || ''}
              onChange={(e) => setMaxInputTokens(Number(e.target.value) || undefined)}
              placeholder="8192"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
              Max Output Tokens / Req
            </label>
            <input
              type="number"
              value={maxOutputTokens || ''}
              onChange={(e) => setMaxOutputTokens(Number(e.target.value) || undefined)}
              placeholder="2048"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Enabled Status */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Policy Active Status
            </div>
            <div className="text-[11px] text-slate-500">
              Emergency kill switch: disabling immediately suspends this feature in the gateway.
            </div>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
        </div>
      </form>
    </Modal>
  );
};
