import React, { useState, useEffect } from 'react';
import { Modal, Button } from '@wapcentral/ui';
import type { FeatureFlag } from '@wapcentral/types';
import { UpsertFeatureFlagSchema, type UpsertFeatureFlagInput } from '@wapcentral/validation';

export interface FeatureFlagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (flagId: string | null, data: UpsertFeatureFlagInput) => Promise<void>;
  initialFlag?: FeatureFlag | null;
}

export const FeatureFlagModal: React.FC<FeatureFlagModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialFlag,
}) => {
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'boolean' | 'string' | 'number'>('boolean');
  const [boolVal, setBoolVal] = useState(true);
  const [strVal, setStrVal] = useState('');
  const [numVal, setNumVal] = useState(0);
  const [scope, setScope] = useState<'global' | 'per_app' | 'per_environment'>('global');
  const [enabled, setEnabled] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialFlag) {
      setKey(initialFlag.key);
      setDescription(initialFlag.description);
      setType(initialFlag.type);
      if (initialFlag.type === 'boolean') {
        setBoolVal(Boolean(initialFlag.value));
      } else if (initialFlag.type === 'number') {
        setNumVal(Number(initialFlag.value));
      } else {
        setStrVal(String(initialFlag.value));
      }
      setScope(initialFlag.scope);
      setEnabled(initialFlag.enabled);
    } else {
      setKey('');
      setDescription('');
      setType('boolean');
      setBoolVal(true);
      setStrVal('');
      setNumVal(0);
      setScope('global');
      setEnabled(true);
    }
    setErrors({});
  }, [initialFlag, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    let value: boolean | string | number = boolVal;
    if (type === 'number') value = numVal;
    if (type === 'string') value = strVal;

    const payload: Record<string, unknown> = {
      key: key.trim(),
      description: description.trim(),
      type,
      value,
      scope,
      enabled,
    };

    const validationResult = UpsertFeatureFlagSchema.safeParse(payload);
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
      await onSubmit(initialFlag?.id ?? null, validationResult.data);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save feature flag';
      setErrors({ general: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialFlag ? 'Edit Configuration Flag' : 'Add Feature Flag'}
      description="Define runtime remote flags and killswitches distributed to apps."
      className="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            {initialFlag ? 'Save Changes' : 'Create Flag'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.general && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-500">
            {errors.general}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Flag Key (snake_case) *
          </label>
          <input
            type="text"
            required
            disabled={!!initialFlag}
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="e.g. enable_banner_ads"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
          />
          {errors.key && <p className="mt-1 text-xs text-rose-500">{errors.key}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Description *
          </label>
          <textarea
            required
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain the purpose of this flag and its impact on mobile clients"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {errors.description && <p className="mt-1 text-xs text-rose-500">{errors.description}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Data Type *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'boolean' | 'string' | 'number')}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="boolean">Boolean (true/false)</option>
              <option value="string">String (text)</option>
              <option value="number">Number (numeric)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Scope *
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'global' | 'per_app' | 'per_environment')}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="global">Global (All Apps)</option>
              <option value="per_app">Per-App Override</option>
              <option value="per_environment">Per-Environment</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Value *
          </label>
          {type === 'boolean' && (
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setBoolVal(true)}
                className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                  boolVal
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                TRUE (Active)
              </button>
              <button
                type="button"
                onClick={() => setBoolVal(false)}
                className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                  !boolVal
                    ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                FALSE (Disabled)
              </button>
            </div>
          )}

          {type === 'string' && (
            <input
              type="text"
              value={strVal}
              onChange={(e) => setStrVal(e.target.value)}
              placeholder="Value string"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          )}

          {type === 'number' && (
            <input
              type="number"
              value={numVal}
              onChange={(e) => setNumVal(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          )}
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Flag is enabled (delivers this value to mobile apps)
            </span>
          </label>
        </div>
      </form>
    </Modal>
  );
};
