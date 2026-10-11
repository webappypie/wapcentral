import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge } from '@wapcentral/ui';
import { Zap, Plus, Trash2, ShieldAlert, Sliders } from 'lucide-react';
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
  const [priority, setPriority] = useState<number>(50);
  const [primaryProviderId, setPrimaryProviderId] = useState('');
  const [primaryModelId, setPrimaryModelId] = useState('');
  const [fallbackChain, setFallbackChain] = useState<FallbackEntry[]>([]);

  // Quotas & Rate Limits
  const [dailyRequestLimit, setDailyRequestLimit] = useState<number | undefined>(50000);
  const [monthlyRequestLimit, setMonthlyRequestLimit] = useState<number | undefined>(1000000);
  const [dailyTokenLimit, setDailyTokenLimit] = useState<number | undefined>(10000000);
  const [monthlyTokenLimit, setMonthlyTokenLimit] = useState<number | undefined>(200000000);
  const [rateLimitRpm, setRateLimitRpm] = useState<number | undefined>(60);
  const [maxInputTokens, setMaxInputTokens] = useState<number | undefined>(8192);
  const [maxOutputTokens, setMaxOutputTokens] = useState<number | undefined>(2048);

  // Circuit Breaker Configuration
  const [failureThreshold, setFailureThreshold] = useState<number>(3);
  const [timeoutMs, setTimeoutMs] = useState<number>(10000);
  const [recoveryTimeMs, setRecoveryTimeMs] = useState<number>(30000);

  const [enabled, setEnabled] = useState(true);

  // New fallback entry inputs
  const [fbProviderId, setFbProviderId] = useState('');
  const [fbModelId, setFbModelId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter only active providers that have active models
  const activeProviders = providers.filter((p) => p.enabled && p.models.some((m) => m.enabled));

  useEffect(() => {
    if (policy) {
      setAppId(policy.appId);
      setFeature(policy.feature);
      setPriority(policy.priority ?? 50);
      setPrimaryProviderId(policy.primaryProviderId);
      setPrimaryModelId(policy.primaryModelId);
      setFallbackChain([...policy.fallbackChain]);

      setDailyRequestLimit(policy.quotas.dailyRequestLimit);
      setMonthlyRequestLimit(policy.quotas.monthlyRequestLimit);
      setDailyTokenLimit(policy.quotas.dailyTokenLimit);
      setMonthlyTokenLimit(policy.quotas.monthlyTokenLimit);
      setRateLimitRpm(policy.quotas.rateLimitRpm);
      setMaxInputTokens(policy.quotas.maxInputTokensPerRequest);
      setMaxOutputTokens(policy.quotas.maxOutputTokensPerRequest);

      setFailureThreshold(policy.circuitBreaker?.failureThreshold ?? 3);
      setTimeoutMs(policy.circuitBreaker?.timeoutMs ?? 10000);
      setRecoveryTimeMs(policy.circuitBreaker?.recoveryTimeMs ?? 30000);

      setEnabled(policy.enabled);
    } else {
      setAppId('app_01');
      setFeature('');
      setPriority(50);

      const firstProv = activeProviders[0] || providers[0];
      const defaultProviderId = firstProv?.id || '';
      const firstModel = firstProv?.models.find((m) => m.enabled) || firstProv?.models[0];
      const defaultModelId = firstModel?.modelId || '';

      setPrimaryProviderId(defaultProviderId);
      setPrimaryModelId(defaultModelId);
      setFallbackChain([]);

      setDailyRequestLimit(50000);
      setMonthlyRequestLimit(1000000);
      setDailyTokenLimit(10000000);
      setMonthlyTokenLimit(200000000);
      setRateLimitRpm(60);
      setMaxInputTokens(8192);
      setMaxOutputTokens(2048);

      setFailureThreshold(3);
      setTimeoutMs(10000);
      setRecoveryTimeMs(30000);

      setEnabled(true);
    }
    setError(null);
  }, [policy, isOpen, providers]);

  // When primary provider changes, auto-select its first enabled model
  const handlePrimaryProviderChange = (newProvId: string) => {
    setPrimaryProviderId(newProvId);
    const p = providers.find((pr) => pr.id === newProvId);
    const firstEnabled = p?.models.find((m) => m.enabled) || p?.models[0];
    if (firstEnabled) {
      setPrimaryModelId(firstEnabled.modelId);
    } else {
      setPrimaryModelId('');
    }
  };

  // When fallback provider changes, auto-select its first enabled model
  const handleFbProviderChange = (newProvId: string) => {
    setFbProviderId(newProvId);
    const p = providers.find((pr) => pr.id === newProvId);
    const firstEnabled = p?.models.find((m) => m.enabled) || p?.models[0];
    if (firstEnabled) {
      setFbModelId(firstEnabled.modelId);
    } else {
      setFbModelId('');
    }
  };

  const handleAddFallback = () => {
    if (!fbProviderId || !fbModelId) {
      setError('Please select both a fallback provider and model.');
      return;
    }

    if (fbProviderId === primaryProviderId && fbModelId === primaryModelId) {
      setError('Fallback route cannot be identical to the primary provider and model.');
      return;
    }

    const alreadyInChain = fallbackChain.some(
      (fb) => fb.providerId === fbProviderId && fb.modelId === fbModelId,
    );
    if (alreadyInChain) {
      setError(`Route '${fbProviderId} / ${fbModelId}' is already in the fallback chain.`);
      return;
    }

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
    setError(null);
  };

  const handleRemoveFallback = (index: number) => {
    const updated = fallbackChain
      .filter((_, i) => i !== index)
      .map((fb, idx) => ({ ...fb, priority: idx + 1 }));
    setFallbackChain(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feature.trim()) {
      setError('Feature / Intent key is required.');
      return;
    }
    if (!primaryProviderId || !primaryModelId) {
      setError('Primary provider and model must be specified.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const quotas = {
        ...(dailyRequestLimit ? { dailyRequestLimit: Number(dailyRequestLimit) } : {}),
        ...(monthlyRequestLimit ? { monthlyRequestLimit: Number(monthlyRequestLimit) } : {}),
        ...(dailyTokenLimit ? { dailyTokenLimit: Number(dailyTokenLimit) } : {}),
        ...(monthlyTokenLimit ? { monthlyTokenLimit: Number(monthlyTokenLimit) } : {}),
        ...(rateLimitRpm ? { rateLimitRpm: Number(rateLimitRpm) } : {}),
        ...(maxInputTokens ? { maxInputTokensPerRequest: Number(maxInputTokens) } : {}),
        ...(maxOutputTokens ? { maxOutputTokensPerRequest: Number(maxOutputTokens) } : {}),
      };

      const circuitBreaker = {
        failureThreshold: Number(failureThreshold) || 3,
        timeoutMs: Number(timeoutMs) || 10000,
        recoveryTimeMs: Number(recoveryTimeMs) || 30000,
      };

      if (isEdit && policy) {
        await onSubmit({
          id: policy.id,
          data: {
            appId: appId.trim(),
            feature: feature.trim(),
            priority: Number(priority) || 50,
            primaryProviderId,
            primaryModelId,
            fallbackChain,
            quotas,
            circuitBreaker,
            enabled,
          },
        });
      } else {
        await onSubmit({
          appId: appId.trim(),
          feature: feature.trim(),
          priority: Number(priority) || 50,
          primaryProviderId,
          primaryModelId,
          fallbackChain,
          quotas,
          circuitBreaker,
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
      description="Configure model failover chains, rate limits, token quotas, and circuit breaker parameters."
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

        <div className="grid grid-cols-3 gap-3">
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Policy Priority (1-100)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 50)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Primary Route */}
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3.5 dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900 dark:text-indigo-300">
            <Zap className="h-4 w-4 text-indigo-600" /> Primary Provider & Allowlisted Model
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Provider
              </label>
              <select
                value={primaryProviderId}
                onChange={(e) => handlePrimaryProviderChange(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.enabled}>
                    {p.name} ({p.type}) {!p.enabled ? '[Disabled]' : ''}
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
                  <option key={m.id} value={m.modelId} disabled={!m.enabled}>
                    {m.name} ({m.modelId}) {!m.enabled ? '[Disabled]' : ''}
                  </option>
                )) || <option value="">No models registered</option>}
              </select>
            </div>
          </div>
        </div>

        {/* Fallback Chain */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Fallback Chain (Automatic Failover)
            </label>
            <span className="text-[11px] text-slate-400">Automatic fallback only when configured</span>
          </div>

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
                No fallback providers configured. Request will fail immediately if primary provider fails.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <select
              value={fbProviderId}
              onChange={(e) => handleFbProviderChange(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Select Fallback Provider...</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.enabled}>
                  {p.name} {!p.enabled ? '[Disabled]' : ''}
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
                <option key={m.id} value={m.modelId} disabled={!m.enabled}>
                  {m.name} {!m.enabled ? '[Disabled]' : ''}
                </option>
              ))}
            </select>

            <Button type="button" size="sm" variant="secondary" onClick={handleAddFallback}>
              <Plus className="mr-1 h-3 w-3" /> Add Fallback
            </Button>
          </div>
        </div>

        {/* Circuit Breaker Configuration */}
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-300">
            <ShieldAlert className="h-4 w-4 text-amber-600" /> Circuit Breaker Protection
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Failure Threshold (trips circuit)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={failureThreshold}
                onChange={(e) => setFailureThreshold(Number(e.target.value) || 3)}
                placeholder="3"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <span className="text-[10px] text-slate-400">Consecutive failures</span>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Provider Timeout (ms)
              </label>
              <input
                type="number"
                min={500}
                max={120000}
                step={500}
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value) || 10000)}
                placeholder="10000"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <span className="text-[10px] text-slate-400">e.g. 10000ms = 10s</span>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Recovery / Cooldown (ms)
              </label>
              <input
                type="number"
                min={1000}
                max={600000}
                step={1000}
                value={recoveryTimeMs}
                onChange={(e) => setRecoveryTimeMs(Number(e.target.value) || 30000)}
                placeholder="30000"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <span className="text-[10px] text-slate-400">Cooldown before half-open</span>
            </div>
          </div>
        </div>

        {/* Quotas & Rate Limits */}
        <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <Sliders className="h-4 w-4 text-indigo-500" /> Quotas & Rate Limits
          </div>

          <div className="grid grid-cols-3 gap-3">
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
                Monthly Request Limit
              </label>
              <input
                type="number"
                value={monthlyRequestLimit || ''}
                onChange={(e) => setMonthlyRequestLimit(Number(e.target.value) || undefined)}
                placeholder="1000000"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Rate Limit (RPM)
              </label>
              <input
                type="number"
                value={rateLimitRpm || ''}
                onChange={(e) => setRateLimitRpm(Number(e.target.value) || undefined)}
                placeholder="60"
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
                Monthly Token Cap
              </label>
              <input
                type="number"
                value={monthlyTokenLimit || ''}
                onChange={(e) => setMonthlyTokenLimit(Number(e.target.value) || undefined)}
                placeholder="200000000"
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
          </div>
        </div>

        {/* Enabled Status */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Policy Active Status
            </div>
            <div className="text-[11px] text-slate-500">
              Disabling immediately suspends routing for this feature at the AI Gateway.
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
