import React, { useState, useEffect } from 'react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Spinner,
  EmptyState,
  ErrorState,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@wapcentral/ui';
import { Sliders, Plus, Check, X, Edit2, Trash2, Search, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import type { FeatureFlag } from '@wapcentral/types';
import type { UpsertFeatureFlagInput } from '@wapcentral/validation';
import {
  subscribeFeatureFlags,
  upsertFeatureFlag,
  toggleFeatureFlag,
  deleteFeatureFlag,
} from '../services/featureFlagsService.js';
import { FeatureFlagModal } from '../components/modals/FeatureFlagModal.js';

type ViewState = 'content' | 'loading' | 'empty' | 'error';

export const ConfigPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const { user, hasRole } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribeFeatureFlags(
      (loaded) => setFlags(loaded),
      () => {},
    );
    return () => unsubscribe();
  }, []);

  const handleOpenAddModal = () => {
    setEditingFlag(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (flagId: string | null, data: UpsertFeatureFlagInput) => {
    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };
    await upsertFeatureFlag(flagId, data, actor);
  };

  const handleToggleFlag = async (flag: FeatureFlag) => {
    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };
    await toggleFeatureFlag(flag.id, !flag.enabled, actor);
  };

  const handleDeleteFlag = async (flagId: string) => {
    if (window.confirm('Are you sure you want to delete this feature flag?')) {
      const actor = {
        uid: user?.uid || 'usr_admin',
        email: user?.email || 'admin@webappypie.com',
      };
      await deleteFeatureFlag(flagId, actor);
    }
  };

  const filteredFlags = flags.filter(
    (f) =>
      f.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Remote Config & Feature Flags"
        description="Dynamic runtime configuration and killswitches distributed to mobile apps"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 text-xs dark:border-slate-800 dark:bg-slate-900">
              {(['content', 'loading', 'empty', 'error'] as ViewState[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setViewState(s)}
                  className={`rounded px-2 py-1 capitalize transition-colors ${
                    viewState === s
                      ? 'bg-indigo-600 font-semibold text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {hasRole('editor') && (
              <Button size="sm" onClick={handleOpenAddModal}>
                <Plus className="mr-1.5 h-4 w-4" /> Add Flag
              </Button>
            )}
          </div>
        }
      />

      {viewState === 'loading' && (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-slate-500">Loading configuration flags...</p>
          </div>
        </div>
      )}

      {viewState === 'empty' && (
        <EmptyState
          title="No configuration flags"
          description="Create your first remote feature flag or killswitch to dynamically control app behavior."
          icon={<Sliders className="h-6 w-6" />}
          actionLabel="Add Flag"
          onAction={() => {
            setViewState('content');
            handleOpenAddModal();
          }}
        />
      )}

      {viewState === 'error' && (
        <ErrorState
          title="Failed to load configuration"
          message="Could not connect to the remote configuration store. Fallback defaults are active."
          onRetry={() => setViewState('content')}
        />
      )}

      {viewState === 'content' && (
        <>
          {/* Dual-Layer Architecture Banner */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-indigo-950 dark:text-indigo-200">
                  Dual-Layer Architecture: Firestore (Primary) & Remote Config (Edge Cache)
                </h4>
                <p className="mt-1 text-xs text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed">
                  Firestore acts as the system of record for dashboard admin changes. Critical flags
                  are published to Firebase Remote Config templates for sub-millisecond edge mobile
                  delivery and resilient offline fallback.
                </p>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search flags by key or description..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Flag Key</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status & Value</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Description</TableHead>
                    {hasRole('editor') && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFlags.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        No feature flags matched your search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredFlags.map((flag) => (
                      <TableRow key={flag.id}>
                        <TableCell className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {flag.key}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-[11px]">
                            {flag.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {hasRole('editor') && flag.type === 'boolean' ? (
                              <button
                                type="button"
                                onClick={() => handleToggleFlag(flag)}
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  flag.enabled && flag.value === true
                                    ? 'bg-emerald-600'
                                    : 'bg-slate-300 dark:bg-slate-700'
                                }`}
                                title="Toggle Flag"
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    flag.enabled && flag.value === true
                                      ? 'translate-x-4'
                                      : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-medium ${
                                  flag.enabled
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-400'
                                }`}
                              >
                                {flag.enabled ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <X className="h-3.5 w-3.5" />
                                )}
                              </span>
                            )}
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                              {String(flag.value)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize text-[11px]">
                            {flag.scope.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-400 max-w-sm">
                          {flag.description}
                        </TableCell>
                        {hasRole('editor') && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditModal(flag)}
                                title="Edit Flag"
                                aria-label="Edit flag"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              {hasRole('admin') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-rose-500 hover:text-rose-600 dark:text-rose-400"
                                  onClick={() => handleDeleteFlag(flag.id)}
                                  title="Delete Flag"
                                  aria-label="Delete flag"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Feature Flag Upsert Modal */}
      <FeatureFlagModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        initialFlag={editingFlag}
      />
    </div>
  );
};
