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
import {
  Sparkles,
  Plus,
  ShieldCheck,
  Zap,
  Activity,
  Coins,
  RefreshCw,
  Settings2,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import type { AiProvider, AiPolicy } from '@wapcentral/types';
import {
  fetchAiProviders,
  createAiProvider,
  updateAiProvider,
  deleteAiProvider,
  checkProviderHealth,
  fetchAiPolicies,
  createAiPolicy,
  updateAiPolicy,
  toggleAiPolicy,
  deleteAiPolicy,
} from '../services/aiService.js';
import { AiProviderModal } from '../components/modals/AiProviderModal.js';
import { AiPolicyModal } from '../components/modals/AiPolicyModal.js';
import type {
  CreateAiProviderInput,
  UpdateAiProviderInput,
  CreateAiPolicyInput,
  UpdateAiPolicyInput,
} from '@wapcentral/validation';

export const AiPage: React.FC = () => {
  const { user, hasRole } = useAuth();

  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [policies, setPolicies] = useState<AiPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'providers' | 'policies' | 'models'>('providers');

  // Health check loading map
  const [testingHealth, setTestingHealth] = useState<Record<string, boolean>>({});

  // Modals state
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AiProvider | null>(null);

  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<AiPolicy | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [provs, pols] = await Promise.all([fetchAiProviders(), fetchAiPolicies()]);
      setProviders(provs);
      setPolicies(pols);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load AI configuration');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleTestHealth = async (providerId: string) => {
    setTestingHealth((prev) => ({ ...prev, [providerId]: true }));
    try {
      const health = await checkProviderHealth(providerId);
      setProviders((prev) =>
        prev.map((p) => (p.id === providerId ? { ...p, healthStatus: health } : p)),
      );
    } catch {
      // Ignored - health is updated in state
    } finally {
      setTestingHealth((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  const handleSaveProvider = async (
    data: CreateAiProviderInput | { id: string; data: UpdateAiProviderInput },
  ) => {
    const actor = { uid: user?.uid || 'unknown', email: user?.email || 'unknown' };
    if ('data' in data) {
      await updateAiProvider(data.id, data.data, actor);
    } else {
      await createAiProvider(data, actor);
    }
    await loadData();
  };

  const handleDeleteProvider = async (providerId: string) => {
    if (!window.confirm(`Are you sure you want to delete AI provider '${providerId}'?`)) return;
    const actor = { uid: user?.uid || 'unknown', email: user?.email || 'unknown' };
    await deleteAiProvider(providerId, actor);
    await loadData();
  };

  const handleSavePolicy = async (
    data: CreateAiPolicyInput | { id: string; data: UpdateAiPolicyInput },
  ) => {
    const actor = { uid: user?.uid || 'unknown', email: user?.email || 'unknown' };
    if ('data' in data) {
      await updateAiPolicy(data.id, data.data, actor);
    } else {
      await createAiPolicy(data, actor);
    }
    await loadData();
  };

  const handleTogglePolicy = async (policyId: string) => {
    const actor = { uid: user?.uid || 'unknown', email: user?.email || 'unknown' };
    await toggleAiPolicy(policyId, actor);
    await loadData();
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!window.confirm('Delete this AI routing policy?')) return;
    const actor = { uid: user?.uid || 'unknown', email: user?.email || 'unknown' };
    await deleteAiPolicy(policyId, actor);
    await loadData();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Gateway & Provider Management"
        description="Unified model routing, multi-tier failover, Secret Manager key vault, and cost estimation"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {hasRole('admin') && activeTab === 'providers' && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedProvider(null);
                  setIsProviderModalOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add Provider
              </Button>
            )}
            {hasRole('editor') && activeTab === 'policies' && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedPolicy(null);
                  setIsPolicyModalOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> New Policy
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => setActiveTab('providers')}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'providers'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            AI Providers ({providers.length})
          </button>

          <button
            onClick={() => setActiveTab('policies')}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'policies'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="h-4 w-4" />
            Routing Policies & Quotas ({policies.length})
          </button>

          <button
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'models'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Coins className="h-4 w-4" />
            Model Catalog & Estimated Rates
          </button>
        </nav>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load AI Gateway configuration"
          message={error}
          onRetry={loadData}
        />
      ) : (
        <>
          {/* TAB 1: PROVIDERS */}
          {activeTab === 'providers' && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {providers.map((p) => {
                  const isHealthy = p.healthStatus?.status === 'healthy';
                  const isTesting = testingHealth[p.id] || false;

                  return (
                    <Card key={p.id} className="flex flex-col justify-between">
                      <div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <div>
                            <CardTitle className="text-base font-semibold">{p.name}</CardTitle>
                            <span className="font-mono text-[11px] text-slate-400">({p.id})</span>
                          </div>
                          <Badge variant={p.enabled ? 'success' : 'secondary'}>
                            {p.enabled ? 'Active' : 'Disabled'}
                          </Badge>
                        </CardHeader>
                        <CardContent className="space-y-2.5 text-xs text-slate-500">
                          <div className="flex justify-between">
                            <span>Type:</span>
                            <span className="font-medium uppercase text-slate-700 dark:text-slate-300">
                              {p.type}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span>Models:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {p.models.length} Allowlisted
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span>Connection:</span>
                            <span
                              className={`flex items-center gap-1 font-medium ${
                                isHealthy
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              <Activity className="h-3 w-3" />
                              {p.healthStatus?.status || 'Unknown'}{' '}
                              {p.healthStatus?.latencyMs ? `(${p.healthStatus.latencyMs}ms)` : ''}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span>Key Vault:</span>
                            <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                              <ShieldCheck className="h-3 w-3" /> Secret Manager
                            </span>
                          </div>
                        </CardContent>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleTestHealth(p.id)}
                          disabled={isTesting}
                        >
                          <Activity
                            className={`mr-1.5 h-3.5 w-3.5 ${isTesting ? 'animate-pulse text-indigo-600' : ''}`}
                          />
                          {isTesting ? 'Testing...' : 'Test Connection'}
                        </Button>

                        <div className="flex items-center gap-1">
                          {hasRole('admin') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedProvider(p);
                                setIsProviderModalOpen(true);
                              }}
                            >
                              <Settings2 className="h-4 w-4 text-slate-500" />
                            </Button>
                          )}
                          {hasRole('super_admin') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteProvider(p.id)}
                            >
                              <Trash2 className="h-4 w-4 text-rose-500" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {providers.length === 0 && (
                <EmptyState
                  title="No AI providers registered"
                  description="Register OpenAI, Google Gemini, Anthropic, or Self-Hosted endpoints."
                  icon={<Sparkles className="h-6 w-6" />}
                  actionLabel="Add Provider"
                  onAction={() => {
                    setSelectedProvider(null);
                    setIsProviderModalOpen(true);
                  }}
                />
              )}
            </div>
          )}

          {/* TAB 2: POLICIES */}
          {activeTab === 'policies' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-indigo-600" /> Feature Routing Policies & Circuit
                  Breakers
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>App / Feature</TableHead>
                      <TableHead>Primary Route</TableHead>
                      <TableHead>Fallback Chain</TableHead>
                      <TableHead>Daily Quota</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policies.map((pol) => (
                      <TableRow key={pol.id}>
                        <TableCell>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {pol.feature}
                          </div>
                          <div className="font-mono text-xs text-slate-400">{pol.appId}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">
                            {pol.primaryProviderId} / {pol.primaryModelId}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {pol.fallbackChain.length > 0 ? (
                            <div className="space-y-1">
                              {pol.fallbackChain.map((fb, i) => (
                                <div key={i} className="text-xs text-slate-600 dark:text-slate-400">
                                  <span className="font-semibold">Tier {fb.priority}:</span>{' '}
                                  {fb.providerId} ({fb.modelId})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">None (Single route)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                          <div>
                            {pol.quotas.dailyRequestLimit
                              ? `${pol.quotas.dailyRequestLimit.toLocaleString()} req/day`
                              : 'Unlimited'}
                          </div>
                          {pol.quotas.dailyTokenLimit && (
                            <div className="text-[11px] text-slate-400">
                              {(pol.quotas.dailyTokenLimit / 1000000).toFixed(1)}M tokens/day
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => handleTogglePolicy(pol.id)}
                            className="cursor-pointer"
                          >
                            <Badge variant={pol.enabled ? 'success' : 'secondary'}>
                              {pol.enabled ? 'Active' : 'Kill Switched'}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {hasRole('editor') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedPolicy(pol);
                                  setIsPolicyModalOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                            )}
                            {hasRole('admin') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePolicy(pol.id)}
                              >
                                <Trash2 className="h-4 w-4 text-rose-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    {policies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-slate-400">
                          No routing policies configured yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: MODEL CATALOG & RATES */}
          {activeTab === 'models' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" /> Model Pricing & Context Catalog
                  </CardTitle>
                  <span className="text-xs text-slate-500">
                    * Costs are estimated USD rates per 1,000,000 tokens
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model Name</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Model ID</TableHead>
                      <TableHead>Est. Input / 1M</TableHead>
                      <TableHead>Est. Output / 1M</TableHead>
                      <TableHead>Max Context</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.flatMap((p) =>
                      p.models.map((m) => (
                        <TableRow key={`${p.id}_${m.id}`}>
                          <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                            {m.name}
                          </TableCell>
                          <TableCell className="uppercase text-xs font-medium text-slate-600 dark:text-slate-400">
                            {p.name}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-500">
                            {m.modelId}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 dark:text-slate-300">
                            {m.inputCostPer1kTokens !== undefined
                              ? `$${(m.inputCostPer1kTokens * 1000).toFixed(2)}`
                              : '$0.00'}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 dark:text-slate-300">
                            {m.outputCostPer1kTokens !== undefined
                              ? `$${(m.outputCostPer1kTokens * 1000).toFixed(2)}`
                              : '$0.00'}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                            {m.maxInputTokens
                              ? `${(m.maxInputTokens / 1000).toFixed(0)}k tokens`
                              : 'Standard'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={m.enabled && p.enabled ? 'success' : 'secondary'}>
                              {m.enabled && p.enabled ? 'Available' : 'Disabled'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )),
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Provider Modal */}
      <AiProviderModal
        isOpen={isProviderModalOpen}
        onClose={() => setIsProviderModalOpen(false)}
        provider={selectedProvider}
        onSubmit={handleSaveProvider}
      />

      {/* Policy Modal */}
      <AiPolicyModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        policy={selectedPolicy}
        providers={providers}
        onSubmit={handleSavePolicy}
      />
    </div>
  );
};
