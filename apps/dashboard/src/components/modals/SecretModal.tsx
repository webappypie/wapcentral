import React, { useState } from 'react';
import { Modal, Button } from '@wapcentral/ui';
import { KeyRound, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import type { SecretItem } from '../../services/secretsService.js';

export interface SecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  secret: SecretItem | null;
  onSubmit: (name: string, value: string) => Promise<void>;
}

export const SecretModal: React.FC<SecretModalProps> = ({ isOpen, onClose, secret, onSubmit }) => {
  const [value, setValue] = useState('');
  const [showPlaintext, setShowPlaintext] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!secret) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError('Secret value cannot be empty');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit(secret.name, value.trim());
      setValue('');
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update secret';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Rotate Credential: ${secret.name}`}
      description={secret.description}
      className="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            Save to Vault
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Security Alert */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-300">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
          <div className="leading-relaxed">
            <strong>Write-Only Credential:</strong> Secrets are transmitted over TLS and encrypted
            inside Google Cloud Secret Manager. Values can never be read back or exported to any
            user.
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-500">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            New Secret Value *
          </label>
          <div className="relative">
            <input
              type={showPlaintext ? 'text' : 'password'}
              required
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste new API key or credential..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-3 pr-10 py-2 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() => setShowPlaintext(!showPlaintext)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Toggle secret visibility"
            >
              {showPlaintext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
