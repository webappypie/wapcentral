import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge } from '@wapcentral/ui';
import { Sparkles, Eye, EyeOff, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import type { AiProvider, AiModel, AiProviderType } from '@wapcentral/types';
import type { CreateAiProviderInput, UpdateAiProviderInput } from '@wapcentral/validation';

export interface AiProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: AiProvider | null; // null = create mode
  onSubmit: (
    data: CreateAiProviderInput | { id: string; data: UpdateAiProviderInput },
  ) => Promise<void>;
}

export const AiProviderModal: React.FC<AiProviderModalProps> = ({
  isOpen,
  onClose,
  provider,
  onSubmit,
}) => {
  const isEdit = !!provider;

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AiProviderType>('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [useExistingSecret, setUseExistingSecret] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [models, setModels] = useState<AiModel[]>([]);
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSecretNameForType = (t: AiProviderType): string => {
    switch (t) {
      case 'openai':
        return 'OPENAI_API_KEY';
      case 'gemini':
        return 'GEMINI_API_KEY';
      case 'anthropic':
        return 'ANTHROPIC_API_KEY';
      case 'self_hosted':
        return 'SELF_HOSTED_AI_CREDENTIALS';
      default:
        return 'API_KEY';
    }
  };

  useEffect(() => {
    if (provider) {
      setId(provider.id);
      setName(provider.name);
      setType(provider.type);
      setBaseUrl(provider.baseUrl || '');
      setApiKey('');
      setUseExistingSecret(true);
      setEnabled(provider.enabled);
      setModels([...provider.models]);
    } else {
      setId('');
      setName('');
      setType('openai');
      setBaseUrl('');
      setApiKey('');
      setUseExistingSecret(true);
      setEnabled(true);
      setModels([
        {
          id: `m_${Date.now()}`,
          providerId: 'new',
          modelId: 'gpt-4o',
          name: 'GPT-4o (Omni)',
          enabled: true,
          inputCostPer1kTokens: 0.0025,
          outputCostPer1kTokens: 0.01,
        },
      ]);
    }
    setError(null);
  }, [provider, isOpen]);

  const handleAddModel = () => {
    if (!newModelId.trim()) return;
    const mId = newModelId.trim();
    const mName = newModelName.trim() || mId;

    let inputCost = 0.001;
    let outputCost = 0.002;
    let maxInput: number | undefined;
    let maxOutput: number | undefined;

    if (mId === 'gpt-4o') {
      inputCost = 0.0025;
      outputCost = 0.01;
      maxInput = 128000;
      maxOutput = 4096;
    } else if (mId === 'gpt-4o-mini') {
      inputCost = 0.00015;
      outputCost = 0.0006;
      maxInput = 128000;
      maxOutput = 4096;
    } else if (mId === 'gemini-3.8-flash' || mId === 'gemini-2.0-flash') {
      inputCost = 0.0001;
      outputCost = 0.0004;
      maxInput = 1048576;
      maxOutput = 8192;
    } else if (mId === 'gemini-2.5-flash' || mId === 'gemini-1.5-flash') {
      inputCost = 0.000075;
      outputCost = 0.0003;
      maxInput = 1048576;
      maxOutput = 8192;
    } else if (mId === 'gemini-2.5-pro' || mId === 'gemini-1.5-pro') {
      inputCost = 0.00125;
      outputCost = 0.005;
      maxInput = 2097152;
      maxOutput = 8192;
    } else if (mId.includes('sonnet')) {
      inputCost = 0.003;
      outputCost = 0.015;
      maxInput = 200000;
      maxOutput = 8192;
    } else if (mId.includes('haiku')) {
      inputCost = 0.0008;
      outputCost = 0.004;
      maxInput = 200000;
      maxOutput = 8192;
    } else if (mId.includes('opus')) {
      inputCost = 0.015;
      outputCost = 0.075;
      maxInput = 200000;
      maxOutput = 4096;
    }

    const newModel: AiModel = {
      id: `m_${Date.now()}`,
      providerId: id || type,
      modelId: mId,
      name: mName,
      enabled: true,
      inputCostPer1kTokens: inputCost,
      outputCostPer1kTokens: outputCost,
      ...(maxInput !== undefined ? { maxInputTokens: maxInput } : {}),
      ...(maxOutput !== undefined ? { maxOutputTokens: maxOutput } : {}),
    };

    setModels([...models, newModel]);
    setNewModelId('');
    setNewModelName('');
  };

  const handleRemoveModel = (index: number) => {
    setModels(models.filter((_, i) => i !== index));
  };

  const sanitizeModelForSubmit = (m: AiModel, pId: string): AiModel => {
    const clean: Record<string, any> = {
      id: m.id || `m_${Date.now()}`,
      providerId: pId,
      modelId: m.modelId,
      name: m.name || m.modelId,
      enabled: m.enabled ?? true,
    };
    if (m.inputCostPer1kTokens !== undefined && m.inputCostPer1kTokens !== null) {
      clean.inputCostPer1kTokens = Number(m.inputCostPer1kTokens);
    }
    if (m.outputCostPer1kTokens !== undefined && m.outputCostPer1kTokens !== null) {
      clean.outputCostPer1kTokens = Number(m.outputCostPer1kTokens);
    }
    if (m.maxInputTokens !== undefined && m.maxInputTokens !== null) {
      clean.maxInputTokens = Number(m.maxInputTokens);
    }
    if (m.maxOutputTokens !== undefined && m.maxOutputTokens !== null) {
      clean.maxOutputTokens = Number(m.maxOutputTokens);
    }
    return clean as AiModel;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Provider name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (isEdit && provider) {
        await onSubmit({
          id: provider.id,
          data: {
            name: name.trim(),
            type,
            enabled,
            ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
            ...(!useExistingSecret && apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
            secretName: getSecretNameForType(type),
            useExistingSecret,
            models: models.map((m) => sanitizeModelForSubmit(m, provider.id)),
          },
        });
      } else {
        if (!id.trim()) {
          setError('Provider ID is required');
          setIsSubmitting(false);
          return;
        }
        const targetId = id.trim().toLowerCase();
        await onSubmit({
          id: targetId,
          name: name.trim(),
          type,
          enabled,
          ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
          ...(!useExistingSecret && apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          secretName: getSecretNameForType(type),
          useExistingSecret,
          models: models.map((m) => sanitizeModelForSubmit(m, targetId)),
        });
      }

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save provider');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Configure Provider: ${provider.name}` : 'Register New AI Provider'}
      description="Manage endpoint connections, model allowlists, and write-only API credentials."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Register Provider'}
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
              Provider ID {!isEdit && <span className="text-rose-500">*</span>}
            </label>
            <input
              type="text"
              value={id}
              disabled={isEdit}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. openai, gemini-vertex, ollama-local"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Display Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. OpenAI Production"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Provider Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AiProviderType)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="openai">OpenAI (GPT-4o, GPT-4o-mini)</option>
              <option value="gemini">Google Gemini (Flash, Pro)</option>
              <option value="anthropic">Anthropic (Claude 3.5)</option>
              <option value="self_hosted">Self-Hosted (Ollama / vLLM)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Base URL (Optional)
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={
                type === 'self_hosted' ? 'http://localhost:11434' : 'https://api.openai.com/v1'
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {/* API Key / Secret Vault */}
        {useExistingSecret ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-950/60 dark:bg-emerald-950/30">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Referencing Secret: <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[11px] text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200">{getSecretNameForType(type)}</code>
              </label>
              <Badge variant="success">Secret Manager</Badge>
            </div>
            <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
              The provider will safely reference the existing secret provisioned in Google Cloud Secret Manager. The key value remains secure and will not be overwritten.
            </p>
            <button
              type="button"
              onClick={() => setUseExistingSecret(false)}
              className="mt-2 text-xs font-medium text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-300"
            >
              Enter / update API key directly instead
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                API Key Credential (Write-Only)
              </label>
              <button
                type="button"
                onClick={() => {
                  setUseExistingSecret(true);
                  setApiKey('');
                }}
                className="text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Use existing {getSecretNameForType(type)} secret
              </button>
            </div>
            <div className="relative mt-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API Key / Token"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Model Allowlist */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Model Allowlist & Rate Limits ({models.length})
          </label>
          <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
            {models.map((m, idx) => (
              <div
                key={m.id || idx}
                className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800/60"
              >
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{m.name}</span>
                  <span className="ml-2 font-mono text-slate-500">({m.modelId})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={m.enabled ? 'success' : 'secondary'}>
                    {m.enabled ? 'Allowlisted' : 'Disabled'}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => handleRemoveModel(idx)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {models.length === 0 && (
              <p className="py-2 text-center text-xs text-slate-400">No models allowlisted yet.</p>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newModelId}
              onChange={(e) => setNewModelId(e.target.value)}
              placeholder="Model ID (e.g. gpt-4o-mini)"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <input
              type="text"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              placeholder="Display Name (optional)"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <Button type="button" size="sm" variant="secondary" onClick={handleAddModel}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>

        {/* Enabled Toggle */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Provider Active Status
            </div>
            <div className="text-[11px] text-slate-500">
              When disabled, the AI Gateway will not route requests to this provider.
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
