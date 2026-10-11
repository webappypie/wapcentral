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
  Terminal,
  Play,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Sliders,
  CheckCircle2,
  ShieldAlert,
  Search,
  Cpu,
  Layers,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import type { AiProvider, AiPolicy, AiPlaygroundResponse, ModelCatalogItem } from '@wapcentral/types';
import { buildDynamicCatalog } from '@wapcentral/provider-sdk';
import {
  subscribeAiProviders,
  subscribeAiPolicies,
  createAiProvider,
  updateAiProvider,
  deleteAiProvider,
  checkProviderHealth,
  createAiPolicy,
  updateAiPolicy,
  toggleAiPolicy,
  deleteAiPolicy,
  runPlaygroundInference,
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
  const [retryNonce, setRetryNonce] = useState(0);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'providers' | 'policies' | 'models' | 'playground'>('providers');

  // Playground State
  const [selectedPlaygroundProviderId, setSelectedPlaygroundProviderId] = useState<string>('');
  const [selectedPlaygroundModelId, setSelectedPlaygroundModelId] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(2048);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [inferenceResponse, setInferenceResponse] = useState<AiPlaygroundResponse | null>(null);
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [isRawExpanded, setIsRawExpanded] = useState<boolean>(false);
  const [hasCopiedResponse, setHasCopiedResponse] = useState<boolean>(false);
  const [hasCopiedRaw, setHasCopiedRaw] = useState<boolean>(false);

  // Health check loading map
  const [testingHealth, setTestingHealth] = useState<Record<string, boolean>>({});

  // Modals state
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AiProvider | null>(null);

  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<AiPolicy | null>(null);

  // Catalog tab filters & search
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogProviderFilter, setCatalogProviderFilter] = useState<string>('all');

  const catalogItems: ModelCatalogItem[] = React.useMemo(() => {
    return buildDynamicCatalog(providers);
  }, [providers]);

  const filteredCatalogItems = React.useMemo(() => {
    return catalogItems.filter((item) => {
      if (catalogProviderFilter !== 'all' && item.providerType !== catalogProviderFilter) {
        return false;
      }
      if (catalogSearch.trim()) {
        const query = catalogSearch.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesId = item.modelId.toLowerCase().includes(query);
        const matchesProvider = (item.providerName || '').toLowerCase().includes(query);
        return matchesName || matchesId || matchesProvider;
      }
      return true;
    });
  }, [catalogItems, catalogProviderFilter, catalogSearch]);

  useEffect(() => {
    if (!user) {
      setProviders([]);
      setPolicies([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubProviders = subscribeAiProviders(
      (loadedProvs) => {
        setProviders(loadedProvs);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
    );

    const unsubPolicies = subscribeAiPolicies(
      (loadedPols) => {
        setPolicies(loadedPols);
      },
      (err) => {
        setError(err.message);
      },
    );

    return () => {
      unsubProviders();
      unsubPolicies();
    };
  }, [user, retryNonce]);

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setRetryNonce((prev) => prev + 1);
  };

  const handleTestHealth = async (providerId: string) => {
    setTestingHealth((prev) => ({ ...prev, [providerId]: true }));
    try {
      const health = await checkProviderHealth(providerId);
      setProviders((prev) =>
        prev.map((p) => (p.id === providerId ? { ...p, healthStatus: health } : p)),
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Health check failed');
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
  };

  const handleDeleteProvider = async (providerId: string) => {
    if (!window.confirm(`Are you sure you want to delete AI provider '${providerId}'?`)) return;
    const actor = { uid: user?.uid || 'unknown', email: user?.email || 'unknown' };
    try {
      await deleteAiProvider(providerId, actor);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete provider');
    }
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
  };

  const handleTogglePolicy = async (policyId: string) => {
    const actor = { uid: user?.uid || 'unknown', email: user?.email || 'unknown' };
    try {
      await toggleAiPolicy(policyId, actor);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to toggle policy');
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!window.confirm('Delete this AI routing policy?')) return;
    const actor = { uid: user?.uid || 'unknown', email: user?.email || 'unknown' };
    try {
      await deleteAiPolicy(policyId, actor);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete policy');
    }
  };

  // Sync playground provider & model selection with active Firestore providers
  useEffect(() => {
    const active = providers.filter((p) => p.enabled);
    if (active.length > 0) {
      if (!selectedPlaygroundProviderId || !active.some((p) => p.id === selectedPlaygroundProviderId)) {
        const first = active[0]!;
        setSelectedPlaygroundProviderId(first.id);
        const firstModel = first.models.find((m) => m.enabled);
        setSelectedPlaygroundModelId(firstModel?.modelId || '');
      }
    } else {
      setSelectedPlaygroundProviderId('');
      setSelectedPlaygroundModelId('');
    }
  }, [providers, selectedPlaygroundProviderId]);

  useEffect(() => {
    const active = providers.filter((p) => p.enabled);
    const curr = active.find((p) => p.id === selectedPlaygroundProviderId);
    const activeModels = curr?.models.filter((m) => m.enabled) || [];
    if (activeModels.length > 0) {
      if (!activeModels.some((m) => m.modelId === selectedPlaygroundModelId)) {
        setSelectedPlaygroundModelId(activeModels[0]!.modelId);
      }
    } else {
      setSelectedPlaygroundModelId('');
    }
  }, [selectedPlaygroundProviderId, providers, selectedPlaygroundModelId]);

  const handleRunPlayground = async () => {
    if (!selectedPlaygroundProviderId || !selectedPlaygroundModelId || !userPrompt.trim()) return;

    setIsExecuting(true);
    setInferenceError(null);
    setInferenceResponse(null);

    try {
      const res = await runPlaygroundInference({
        providerId: selectedPlaygroundProviderId,
        modelId: selectedPlaygroundModelId,
        prompt: userPrompt.trim(),
        systemPrompt: systemPrompt.trim() || undefined,
        temperature,
        maxTokens,
      });
      setInferenceResponse(res);
    } catch (err: unknown) {
      setInferenceError(err instanceof Error ? err.message : 'Inference request failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyResponse = () => {
    if (!inferenceResponse?.content) return;
    navigator.clipboard.writeText(inferenceResponse.content);
    setHasCopiedResponse(true);
    setTimeout(() => setHasCopiedResponse(false), 2000);
  };

  const handleCopyRaw = () => {
    if (!inferenceResponse) return;
    navigator.clipboard.writeText(JSON.stringify(inferenceResponse.raw || inferenceResponse, null, 2));
    setHasCopiedRaw(true);
    setTimeout(() => setHasCopiedRaw(false), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Gateway & Provider Management"
        description="Unified model routing, multi-tier failover, Secret Manager key vault, and cost estimation"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleRetry} disabled={isLoading}>
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

          <button
            onClick={() => setActiveTab('playground')}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'playground'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Terminal className="h-4 w-4" />
            AI Playground
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
          onRetry={handleRetry}
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
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-indigo-600" /> Feature Routing Policies & Circuit Breakers
                  </CardTitle>
                  <span className="text-xs text-slate-500">
                    Live telemetry counters enforce daily/monthly quotas and circuit breaker failover.
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>App / Feature</TableHead>
                      <TableHead>Primary Route</TableHead>
                      <TableHead>Fallback Chain</TableHead>
                      <TableHead>Circuit Breaker</TableHead>
                      <TableHead>Quotas & Real Telemetry</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policies.map((pol) => {
                      const cbStatus = pol.usageStats?.circuitBreaker?.status || 'closed';
                      const cbBadgeVariant =
                        cbStatus === 'open'
                          ? 'destructive'
                          : cbStatus === 'half_open'
                            ? 'warning'
                            : 'success';

                      return (
                        <TableRow key={pol.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {pol.feature}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                P{pol.priority ?? 50}
                              </Badge>
                            </div>
                            <div className="font-mono text-xs text-slate-400">{pol.appId}</div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="default">
                              {pol.primaryProviderId} / {pol.primaryModelId}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            {pol.fallbackChain && pol.fallbackChain.length > 0 ? (
                              <div className="space-y-1">
                                {pol.fallbackChain.map((fb, i) => (
                                  <div key={i} className="text-xs text-slate-600 dark:text-slate-400">
                                    <span className="font-semibold">Tier {fb.priority}:</span>{' '}
                                    {fb.providerId} ({fb.modelId})
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">None (Fail fast)</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <Badge variant={cbBadgeVariant} className="uppercase text-[10px]">
                                  {cbStatus === 'open'
                                    ? 'OPEN (Tripped)'
                                    : cbStatus === 'half_open'
                                      ? 'HALF-OPEN'
                                      : 'CLOSED (Healthy)'}
                                </Badge>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Thresh: {pol.circuitBreaker?.failureThreshold ?? 3} fails |{' '}
                                {((pol.circuitBreaker?.timeoutMs ?? 10000) / 1000).toFixed(0)}s timeout
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Cooldown: {((pol.circuitBreaker?.recoveryTimeMs ?? 30000) / 1000).toFixed(0)}s
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                            <div>
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                Daily Req:
                              </span>{' '}
                              {pol.usageStats?.dailyRequests ?? 0} /{' '}
                              {pol.quotas.dailyRequestLimit
                                ? pol.quotas.dailyRequestLimit.toLocaleString()
                                : '∞'}
                              {pol.quotas.dailyRequestLimit && (
                                <span className="ml-1 text-[11px] text-indigo-600 dark:text-indigo-400">
                                  ({(pol.usageStats?.remainingDailyRequests ?? pol.quotas.dailyRequestLimit).toLocaleString()} left)
                                </span>
                              )}
                            </div>

                            <div>
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                Daily Tokens:
                              </span>{' '}
                              {(((pol.usageStats?.dailyTokens ?? 0)) / 1000).toFixed(1)}k /{' '}
                              {pol.quotas.dailyTokenLimit
                                ? (pol.quotas.dailyTokenLimit / 1000000).toFixed(1) + 'M'
                                : '∞'}
                            </div>

                            <div className="text-[11px] text-slate-400">
                              Monthly: {pol.usageStats?.monthlyRequests ?? 0} req
                              {pol.quotas.rateLimitRpm ? ` | ${pol.quotas.rateLimitRpm} rpm` : ''}
                            </div>
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
                      );
                    })}

                    {policies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-slate-400">
                          No routing policies configured yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: MODEL PRICING & CONTEXT CATALOG */}
          {activeTab === 'models' && (
            <div className="space-y-6">
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                      <Cpu className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500">Verified Models</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {catalogItems.length}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500">Active in Production</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {catalogItems.filter((m) => m.status === 'available').length}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                      <Coins className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500">Low Cost Tier (&le;$1/1M)</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {catalogItems.filter((m) => m.inputCostPer1M !== null && m.inputCostPer1M <= 1.0).length}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500">Max Context Window</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        2,097,152 tokens
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Catalog Card */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-amber-500" /> Model Pricing & Context Catalog
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-1">
                        Verified production model pricing and context limits per 1,000,000 tokens based on official provider specifications.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs font-normal">
                      Verified Official Provider Rates (Oct 2026)
                    </Badge>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium text-slate-500 mr-1 flex items-center gap-1">
                        <Sliders className="h-3 w-3" /> Provider:
                      </span>
                      {[
                        { id: 'all', label: 'All Providers' },
                        { id: 'openai', label: 'OpenAI' },
                        { id: 'gemini', label: 'Google Gemini' },
                        { id: 'anthropic', label: 'Anthropic' },
                        { id: 'self_hosted', label: 'Self-Hosted' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setCatalogProviderFilter(tab.id)}
                          className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                            catalogProviderFilter === tab.id
                              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative min-w-[240px]">
                      <input
                        type="text"
                        placeholder="Search models..."
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model Name & Capabilities</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Model ID</TableHead>
                        <TableHead>Input / 1M Tokens</TableHead>
                        <TableHead>Output / 1M Tokens</TableHead>
                        <TableHead>Context Window</TableHead>
                        <TableHead>Max Output</TableHead>
                        <TableHead>Official Verification Source</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCatalogItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {item.name}
                            </div>
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {item.supportsVision && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                  Vision
                                </span>
                              )}
                              {item.supportsStreaming && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                  Streaming
                                </span>
                              )}
                              {item.supportsFunctionCalling && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                                  Tools
                                </span>
                              )}
                              {item.supportsEmbeddings && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                  Embeddings
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <span className="uppercase text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {item.providerName || item.providerType}
                            </span>
                          </TableCell>

                          <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                            {item.modelId}
                          </TableCell>

                          <TableCell className="text-xs font-medium text-slate-900 dark:text-slate-100">
                            {item.inputCostPer1M !== null
                              ? `$${item.inputCostPer1M.toFixed(item.inputCostPer1M < 0.1 ? 3 : 2)}`
                              : 'Not available'}
                          </TableCell>

                          <TableCell className="text-xs font-medium text-slate-900 dark:text-slate-100">
                            {item.outputCostPer1M !== null
                              ? `$${item.outputCostPer1M.toFixed(item.outputCostPer1M < 0.1 ? 3 : 2)}`
                              : 'Not available'}
                          </TableCell>

                          <TableCell className="text-xs text-slate-700 dark:text-slate-300">
                            {item.contextWindow !== null ? `${item.contextWindow.toLocaleString()} tokens` : 'Not available'}
                          </TableCell>

                          <TableCell className="text-xs text-slate-700 dark:text-slate-300">
                            {item.maxOutputTokens !== null ? `${item.maxOutputTokens.toLocaleString()} tokens` : 'Not available'}
                          </TableCell>

                          <TableCell>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                              {item.source}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Verified: {item.lastVerifiedDate}
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant={
                                item.status === 'available'
                                  ? 'success'
                                  : item.status === 'disabled'
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {item.status === 'available'
                                ? 'Available'
                                : item.status === 'disabled'
                                  ? 'Disabled'
                                  : 'Catalog Spec'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}

                      {filteredCatalogItems.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="py-8 text-center text-slate-400">
                            No models found matching the search criteria.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 4: AI PLAYGROUND */}
          {activeTab === 'playground' && (
            <div className="space-y-6">
              {providers.filter((p) => p.enabled).length === 0 ? (
                <EmptyState
                  title="No active AI providers available"
                  description="To use the AI Playground, at least one AI provider must be enabled in Firestore."
                  icon={<Terminal className="h-6 w-6" />}
                  actionLabel="Add or Enable Provider"
                  onAction={() => setActiveTab('providers')}
                />
              ) : (
                <div className="grid gap-6 lg:grid-cols-12">
                  {/* Left Column: Request Configuration & Inputs */}
                  <div className="space-y-6 lg:col-span-5">
                    <Card>
                      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Sliders className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            Request Parameters
                          </CardTitle>
                          <Badge variant="default" className="text-[10px]">
                            Live Backend
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4 pt-4">
                        {/* 1. Provider Selector */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            AI Provider <span className="text-rose-500">*</span>
                          </label>
                          <select
                            id="playground-provider-select"
                            value={selectedPlaygroundProviderId}
                            onChange={(e) => {
                              setSelectedPlaygroundProviderId(e.target.value);
                            }}
                            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {providers
                              .filter((p) => p.enabled)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.id}) — {p.type.toUpperCase()}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* 2. Model Selector */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Model <span className="text-rose-500">*</span>
                          </label>
                          {(() => {
                            const curProv = providers.find((p) => p.id === selectedPlaygroundProviderId);
                            const activeModels = curProv?.models.filter((m) => m.enabled) || [];

                            if (activeModels.length === 0) {
                              return (
                                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                                  No enabled models found for this provider. Enable models in the Providers tab.
                                </div>
                              );
                            }

                            return (
                              <select
                                id="playground-model-select"
                                value={selectedPlaygroundModelId}
                                onChange={(e) => setSelectedPlaygroundModelId(e.target.value)}
                                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                {activeModels.map((m) => (
                                  <option key={m.id} value={m.modelId}>
                                    {m.name} ({m.modelId})
                                  </option>
                                ))}
                              </select>
                            );
                          })()}
                        </div>

                        {/* 5. Temperature Control */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between items-center text-xs">
                            <label className="font-semibold text-slate-700 dark:text-slate-300">
                              Temperature
                            </label>
                            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              {temperature.toFixed(1)}
                            </span>
                          </div>
                          <input
                            type="range"
                            id="playground-temperature"
                            min="0"
                            max="2"
                            step="0.1"
                            value={temperature}
                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>0.0 (Deterministic)</span>
                            <span>0.7 (Default)</span>
                            <span>2.0 (Creative)</span>
                          </div>
                        </div>

                        {/* 6. Max Output Tokens */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between items-center text-xs">
                            <label className="font-semibold text-slate-700 dark:text-slate-300">
                              Max Output Tokens
                            </label>
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                              {maxTokens.toLocaleString()}
                            </span>
                          </div>
                          <input
                            type="number"
                            id="playground-max-tokens"
                            min={1}
                            max={8192}
                            value={maxTokens}
                            onChange={(e) => setMaxTokens(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="text-[10px] text-slate-400">
                            Standard maximum generation limit (up to 8,192 tokens)
                          </span>
                        </div>

                        {/* 3. System Prompt (Optional) */}
                        <div className="space-y-1.5 pt-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            System Prompt <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <textarea
                            id="playground-system-prompt"
                            rows={2}
                            placeholder="Optional instructions for the model (e.g. You are a helpful assistant for mobile developers)..."
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                          />
                        </div>

                        {/* 4. User Prompt */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between items-center">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                              User Prompt <span className="text-rose-500">*</span>
                            </label>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {userPrompt.length} chars (~{Math.ceil(userPrompt.length / 4)} tokens)
                            </span>
                          </div>
                          <textarea
                            id="playground-user-prompt"
                            rows={5}
                            placeholder="Enter your prompt here to send an actual live inference request through the AI Gateway..."
                            value={userPrompt}
                            onChange={(e) => setUserPrompt(e.target.value)}
                            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                          />
                        </div>

                        {/* 7. Run Request Button & Reset */}
                        <div className="flex items-center gap-3 pt-2">
                          <Button
                            id="playground-run-button"
                            size="sm"
                            onClick={handleRunPlayground}
                            disabled={
                              isExecuting ||
                              !userPrompt.trim() ||
                              !selectedPlaygroundProviderId ||
                              !selectedPlaygroundModelId
                            }
                            className="w-full flex-1"
                          >
                            {isExecuting ? (
                              <>
                                <Spinner size="sm" className="mr-2" />
                                Running Request...
                              </>
                            ) : (
                              <>
                                <Play className="mr-2 h-4 w-4 fill-current" />
                                Run Request
                              </>
                            )}
                          </Button>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setUserPrompt('');
                              setInferenceResponse(null);
                              setInferenceError(null);
                            }}
                            disabled={isExecuting || (!userPrompt && !inferenceResponse && !inferenceError)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column: Live Model Output & Performance Metrics */}
                  <div className="space-y-6 lg:col-span-7">
                    <Card className="flex flex-col min-h-[580px]">
                      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Terminal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            Live Inference Output
                          </CardTitle>

                          {inferenceResponse && (
                            <div className="flex items-center gap-2">
                              <Badge variant="success" className="text-[11px] font-mono">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                                {inferenceResponse.providerId} / {inferenceResponse.modelId}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCopyResponse}
                                className="h-7 px-2 text-xs"
                              >
                                {hasCopiedResponse ? (
                                  <>
                                    <Check className="mr-1 h-3 w-3 text-emerald-500" />
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="mr-1 h-3 w-3 text-slate-400" />
                                    Copy
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="flex-1 flex flex-col justify-between p-5 space-y-5">
                        {/* 9. Request Status: Loading */}
                        {isExecuting && (
                          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
                            <Spinner size="lg" className="text-indigo-600" />
                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                              Routing inference request via AI Gateway...
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              Executing {selectedPlaygroundProviderId} / {selectedPlaygroundModelId}
                            </div>
                          </div>
                        )}

                        {/* 9. Request Status: Error */}
                        {!isExecuting && inferenceError && (
                          <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/50 dark:bg-rose-950/20 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-400">
                              <AlertCircle className="h-4 w-4 shrink-0" />
                              Gateway Inference Error
                            </div>
                            <p className="text-xs text-rose-600 dark:text-rose-300 font-mono break-words">
                              {inferenceError}
                            </p>
                          </div>
                        )}

                        {/* Initial Idle State */}
                        {!isExecuting && !inferenceResponse && !inferenceError && (
                          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3 text-slate-400">
                            <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800">
                              <Terminal className="h-6 w-6 text-slate-400" />
                            </div>
                            <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
                              AI Playground Ready
                            </div>
                            <p className="text-xs text-slate-400 max-w-sm">
                              Select an active provider, choose an allowlisted model, enter your prompt, and click{' '}
                              <strong className="text-slate-700 dark:text-slate-300">Run Request</strong> to send an
                              actual AI inference request.
                            </p>
                          </div>
                        )}

                        {/* 8. Successful Model Response & 10. Metrics */}
                        {!isExecuting && inferenceResponse && (
                          <div className="space-y-5 flex-1 flex flex-col justify-between">
                            {/* 10. Metrics Bar: Latency, Tokens, Cost */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-2.5">
                                <div className="text-[10px] font-medium uppercase text-slate-400">Latency</div>
                                <div className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
                                  {inferenceResponse.latencyMs} ms
                                </div>
                              </div>

                              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-2.5">
                                <div className="text-[10px] font-medium uppercase text-slate-400">Input Tokens</div>
                                <div className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
                                  {inferenceResponse.usage.inputTokens.toLocaleString()}
                                </div>
                              </div>

                              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-2.5">
                                <div className="text-[10px] font-medium uppercase text-slate-400">Output Tokens</div>
                                <div className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
                                  {inferenceResponse.usage.outputTokens.toLocaleString()}
                                </div>
                              </div>

                              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-2.5">
                                <div className="text-[10px] font-medium uppercase text-slate-400">Total Tokens</div>
                                <div className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
                                  {inferenceResponse.usage.totalTokens.toLocaleString()}
                                </div>
                              </div>

                              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-2.5 col-span-2 sm:col-span-1">
                                <div className="text-[10px] font-medium uppercase text-slate-400">Estimated Cost</div>
                                <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                                  ${inferenceResponse.costEstimate.amountUsd < 0.0001
                                    ? inferenceResponse.costEstimate.amountUsd.toFixed(6)
                                    : inferenceResponse.costEstimate.amountUsd.toFixed(4)}
                                </div>
                              </div>
                            </div>

                            {/* 8. Actual Model Response Body */}
                            <div className="flex-1 space-y-2">
                              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                Model Response Content:
                              </div>
                              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
                                {inferenceResponse.content}
                              </div>
                            </div>

                            {/* 11. Optional Expandable Raw Response */}
                            <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                              <button
                                type="button"
                                onClick={() => setIsRawExpanded(!isRawExpanded)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                              >
                                {isRawExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                                Raw Gateway Response (JSON)
                              </button>

                              {isRawExpanded && (
                                <div className="mt-2.5 relative">
                                  <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-56 border border-slate-800">
                                    {JSON.stringify(inferenceResponse.raw || inferenceResponse, null, 2)}
                                  </pre>
                                  <button
                                    onClick={handleCopyRaw}
                                    className="absolute top-2 right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] rounded border border-slate-700"
                                  >
                                    {hasCopiedRaw ? 'Copied JSON!' : 'Copy JSON'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
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
