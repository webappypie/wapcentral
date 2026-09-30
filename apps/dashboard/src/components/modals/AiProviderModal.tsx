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
  const [enabled, setEnabled] = useState(true);
  const [models, setModels] = useState<AiModel[]>([]);
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (provider) {
      setId(provider.id);
      setName(provider.name);
      setType(provider.type);
      setBaseUrl(provider.baseUrl || '');
      setApiKey('');
      setEnabled(provider.enabled);
      setModels([...provider.models]);
    } else {
      setId('');
      setName('');
      setType('openai');
      setBaseUrl('');
      setApiKey('');
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
    setModels([
      ...models,
      {
        id: `m_${Date.now()}`,
        providerId: id || type,
        modelId: mId,
        name: mName,
        enabled: true,
        inputCostPer1kTokens: 0.001,
        outputCostPer1kTokens: 0.002,
      },
    ]);
    setNewModelId('');
    setNewModelName('');
  };

  const handleRemoveModel = (index: number) => {
    setModels(models.filter((_, i) => i !== index));
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
            ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
            models,
          },
        });
      } else {
        if (!id.trim()) {
          setError('Provider ID is required');
          setIsSubmitting(false);
          return;
        }
        await onSubmit({
          id: id.trim().toLowerCase(),
          name: name.trim(),
          type,
          enabled,
          ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          models: models.map((m) => ({ ...m, providerId: id.trim().toLowerCase() })),
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
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              API Key Credential (Write-Only)
            </label>
            <span className="text-[11px] text-slate-500">Stored in Secret Manager</span>
          </div>
          <div className="relative mt-2">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                isEdit ? '•••••••••••••••• (Leave blank to keep existing)' : 'Enter API Key / Token'
              }
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
