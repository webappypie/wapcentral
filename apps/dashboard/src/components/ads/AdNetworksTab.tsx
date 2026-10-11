import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Modal,
} from '@wapcentral/ui';
import {
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Trash2,
  Activity,
  Layers,
  Info,
} from 'lucide-react';
import type { AdNetwork, AdFormat } from '@wapcentral/types';
import {
  createAdNetwork,
  updateAdNetwork,
  deleteAdNetwork,
} from '../../services/adsService.js';
import { useAuth } from '../../contexts/AuthContext.js';

interface AdNetworksTabProps {
  networks: AdNetwork[];
}

const ALL_FORMATS: AdFormat[] = [
  'banner',
  'native',
  'interstitial',
  'rewarded',
  'app_open',
  'rewarded_interstitial',
];

export const AdNetworksTab: React.FC<AdNetworksTabProps> = ({ networks }) => {
  const { user, hasRole } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState<AdNetwork | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formMode, setFormMode] = useState<'production' | 'test'>('production');
  const [formSecretRef, setFormSecretRef] = useState('');
  const [formPriority, setFormPriority] = useState(1);
  const [formNotes, setFormNotes] = useState('');
  const [formFormats, setFormFormats] = useState<AdFormat[]>(['banner', 'interstitial']);

  const openAddModal = () => {
    setEditingNetwork(null);
    setFormId(`net_${Date.now().toString(36)}`);
    setFormName('');
    setFormEnabled(true);
    setFormMode('production');
    setFormSecretRef('');
    setFormPriority(networks.length + 1);
    setFormNotes('');
    setFormFormats(['banner', 'interstitial']);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (net: AdNetwork) => {
    setEditingNetwork(net);
    setFormId(net.id);
    setFormName(net.name);
    setFormEnabled(net.enabled);
    setFormMode(net.environmentMode);
    setFormSecretRef(net.secretReferenceName || '');
    setFormPriority(net.priority);
    setFormNotes(net.notes || '');
    setFormFormats([...net.supportedFormats]);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const toggleFormat = (fmt: AdFormat) => {
    if (formFormats.includes(fmt)) {
      if (formFormats.length === 1) return; // Keep at least one
      setFormFormats(formFormats.filter((f) => f !== fmt));
    } else {
      setFormFormats([...formFormats, fmt]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMessage('Network name is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };

    try {
      if (editingNetwork) {
        await updateAdNetwork(
          editingNetwork.id,
          {
            name: formName.trim(),
            enabled: formEnabled,
            environmentMode: formMode,
            secretReferenceName: formSecretRef.trim() || undefined,
            priority: formPriority,
            supportedFormats: formFormats,
            notes: formNotes.trim() || undefined,
          },
          actor,
        );
      } else {
        await createAdNetwork(
          {
            id: formId.trim().toLowerCase(),
            name: formName.trim(),
            enabled: formEnabled,
            environmentMode: formMode,
            secretReferenceName: formSecretRef.trim() || undefined,
            priority: formPriority,
            supportedFormats: formFormats,
            notes: formNotes.trim() || undefined,
            allowedAppIds: ['*'],
          },
          actor,
        );
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save ad network.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleEnabled = async (net: AdNetwork) => {
    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };
    try {
      await updateAdNetwork(net.id, { enabled: !net.enabled }, actor);
    } catch (err) {
      console.error('Failed to toggle network:', err);
    }
  };

  const handleDelete = async (net: AdNetwork) => {
    if (!confirm(`Are you sure you want to remove ${net.name}? This will affect waterfall mediation.`)) {
      return;
    }
    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };
    try {
      await deleteAdNetwork(net.id, actor);
    } catch (err) {
      console.error('Failed to delete network:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/40">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm text-blue-950 dark:text-blue-100">
              Provider Secrets & Credentials Architecture
            </h4>
            <p className="text-xs text-blue-800 dark:text-blue-300">
              Provider API keys and tokens are stored exclusively in <strong>Google Cloud Secret Manager</strong>.
              Only secret reference keys (e.g., <code>ADMOB_REPORTING_CREDENTIALS</code>) are stored here.
              Secrets are never exposed to client applications or plain Firestore documents.
            </p>
          </div>
        </div>
        {hasRole('editor') && (
          <Button size="sm" onClick={openAddModal} className="flex items-center gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            Add Network
          </Button>
        )}
      </div>

      {/* Network Cards Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {networks
          .sort((a, b) => a.priority - b.priority)
          .map((net) => {
            return (
              <Card key={net.id} className="relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">{net.name}</CardTitle>
                      <p className="font-mono text-xs text-slate-500">ID: {net.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs font-mono uppercase ${
                        net.environmentMode === 'production'
                          ? 'border-emerald-300 text-emerald-700'
                          : 'border-amber-300 text-amber-700'
                      }`}
                    >
                      {net.environmentMode}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Priority #{net.priority}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status & Latency */}
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Health Status</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {net.healthStatus.status === 'healthy' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="text-xs font-medium capitalize">
                          {net.healthStatus.status}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Round-Trip Latency</span>
                      <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5 block">
                        {net.healthStatus.latencyMs ? `${net.healthStatus.latencyMs} ms` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Secret Reference */}
                  <div>
                    <span className="text-[11px] font-medium text-slate-500 block mb-1">
                      Credentials Source
                    </span>
                    <div className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                      <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="truncate">
                        {net.secretReferenceName ? (
                          net.secretReferenceName
                        ) : (
                          <span className="text-slate-400">First-Party / In-House (No Third-Party Secret)</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Supported Formats */}
                  <div>
                    <span className="text-[11px] font-medium text-slate-500 block mb-1">
                      Supported Ad Formats
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {net.supportedFormats.map((fmt) => (
                        <span
                          key={fmt}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {fmt}
                        </span>
                      ))}
                    </div>
                  </div>

                  {net.notes && (
                    <p className="text-xs text-slate-500 italic">"{net.notes}"</p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={net.enabled}
                        onChange={() => handleToggleEnabled(net)}
                        disabled={!hasRole('editor')}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {net.enabled ? 'Network Enabled' : 'Network Disabled'}
                      </span>
                    </label>

                    {hasRole('editor') && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(net)}
                          className="h-8 px-2.5 text-xs"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(net)}
                          className="h-8 px-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Add / Edit Network Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingNetwork ? `Edit Network: ${editingNetwork.name}` : 'Register New Ad Network'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="rounded bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Network Identifier
            </label>
            <input
              type="text"
              required
              disabled={Boolean(editingNetwork)}
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              placeholder="e.g. admob, meta, applovin, unity_ads"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Google AdMob"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Environment Mode
              </label>
              <select
                value={formMode}
                onChange={(e) => setFormMode(e.target.value as any)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="production">Production Mode</option>
                <option value="test">Test Mode (Sandbox / Test Devices)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Waterfall Priority (1 = Top)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={formPriority}
                onChange={(e) => setFormPriority(parseInt(e.target.value, 10) || 1)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
              </input>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Secret Manager Key Reference (Optional for House Ads)
            </label>
            <input
              type="text"
              value={formSecretRef}
              onChange={(e) => setFormSecretRef(e.target.value)}
              placeholder="e.g. ADMOB_REPORTING_CREDENTIALS"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 font-mono"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Points to GCP Secret Manager. Raw secret keys are never accepted here.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Supported Ad Formats
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_FORMATS.map((fmt) => (
                <label
                  key={fmt}
                  className="flex items-center gap-2 rounded border border-slate-200 p-2 text-xs dark:border-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formFormats.includes(fmt)}
                    onChange={() => toggleFormat(fmt)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="capitalize">{fmt.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Internal Operational Notes
            </label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Operational routing or mediation tier notes..."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formEnabled}
                onChange={(e) => setFormEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Network Enabled
              </span>
            </label>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingNetwork ? 'Update Network' : 'Create Network'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
