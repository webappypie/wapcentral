import React, { useState, useEffect } from 'react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatusIndicator,
  Button,
  Badge,
  Spinner,
  EmptyState,
  Table,
  Modal,
} from '@wapcentral/ui';
import {
  Server,
  Activity,
  Database,
  Cpu,
  RefreshCw,
  Bell,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Zap,
  Globe,
  Radio,
} from 'lucide-react';
import type {
  DetailedServiceHealth,
  AiServerMetrics,
  InfrastructureAlertRule,
  InfrastructureAlertTrigger,
  PlatformHealthOverview,
  ServiceCategory,
  InfrastructureAlertMetric,
  InfrastructureAlertSeverity,
} from '@wapcentral/types';
import {
  subscribePlatformHealth,
  subscribeAiServerMetrics,
  subscribeInfrastructureAlerts,
  triggerServiceHealthCheck,
  createInfrastructureAlertRule,
  toggleInfrastructureAlertRule,
  deleteInfrastructureAlertRule,
  simulateAiServerLoad,
} from '../services/infrastructureService.js';
import { useAuth } from '../contexts/AuthContext.js';

type Tab = 'matrix' | 'ai_node' | 'alerts';

export const InfrastructurePage: React.FC = () => {
  const { user } = useAuth();
  const actor = {
    uid: user?.uid ?? 'usr_admin_default',
    email: user?.email ?? 'admin@webappypie.com',
  };

  const [activeTab, setActiveTab] = useState<Tab>('matrix');
  const [services, setServices] = useState<DetailedServiceHealth[]>([]);
  const [overview, setOverview] = useState<PlatformHealthOverview | null>(null);
  const [aiMetrics, setAiMetrics] = useState<AiServerMetrics | null>(null);
  const [alertRules, setAlertRules] = useState<InfrastructureAlertRule[]>([]);
  const [alertTriggers, setAlertTriggers] = useState<InfrastructureAlertTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [probingServiceId, setProbingServiceId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleTarget, setNewRuleTarget] = useState('all');
  const [newRuleMetric, setNewRuleMetric] = useState<InfrastructureAlertMetric>('latency_ms');
  const [newRuleThreshold, setNewRuleThreshold] = useState('300');
  const [newRuleSeverity, setNewRuleSeverity] = useState<InfrastructureAlertSeverity>('warning');
  const [newRuleEmails, setNewRuleEmails] = useState('');
  const [savingRule, setSavingRule] = useState(false);

  useEffect(() => {
    setLoading(true);

    const unsubHealth = subscribePlatformHealth((loadedServices, loadedOverview) => {
      setServices(loadedServices);
      setOverview(loadedOverview);
      setLoading(false);
    });

    const unsubAi = subscribeAiServerMetrics((loadedMetrics) => {
      setAiMetrics(loadedMetrics);
    });

    const unsubAlerts = subscribeInfrastructureAlerts((rules, triggers) => {
      setAlertRules(rules);
      setAlertTriggers(triggers);
    });

    return () => {
      unsubHealth();
      unsubAi();
      unsubAlerts();
    };
  }, []);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await triggerServiceHealthCheck();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePingSingle = async (serviceId: string) => {
    setProbingServiceId(serviceId);
    try {
      await triggerServiceHealthCheck(serviceId);
    } finally {
      setProbingServiceId(null);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRule(true);
    try {
      const emailList = newRuleEmails
        .split(',')
        .map((em) => em.trim())
        .filter(Boolean);

      await createInfrastructureAlertRule(
        {
          name: newRuleName,
          targetServiceId: newRuleTarget,
          metric: newRuleMetric,
          threshold: Number(newRuleThreshold),
          severity: newRuleSeverity,
          enabled: true,
          notifyEmails: emailList.length > 0 ? emailList : ['ops@webappypie.com'],
        },
        actor,
      );

      setIsModalOpen(false);
      setNewRuleName('');
      setNewRuleEmails('');
    } finally {
      setSavingRule(false);
    }
  };

  const handleToggleRule = async (ruleId: string, currentEnabled: boolean) => {
    await toggleInfrastructureAlertRule(ruleId, !currentEnabled, actor);
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (confirm('Are you sure you want to delete this infrastructure alert rule?')) {
      await deleteInfrastructureAlertRule(ruleId, actor);
    }
  };

  const filteredServices = services.filter((svc) => {
    if (categoryFilter === 'all') return true;
    return svc.category === categoryFilter;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Infrastructure Health & Telemetry"
        description="Continuous heartbeat monitoring, AI inference cluster telemetry, and automated operational alerts."
        actions={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Auto-Polling Active
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={isRefreshing}
              onClick={handleRefreshAll}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Probe All Services
            </Button>
          </div>
        }
      />

      {/* Top Level Platform Status & KPIs */}
      {overview && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Platform Status
              </CardTitle>
              <Activity className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center gap-2">
                <StatusIndicator status={overview.overallStatus} />
                <span className="text-lg font-bold capitalize text-slate-900 dark:text-white">
                  {overview.overallStatus === 'healthy'
                    ? 'All Systems Operational'
                    : overview.overallStatus === 'degraded'
                      ? 'Performance Degraded'
                      : 'Critical Issues Detected'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {overview.healthyCount} of {overview.totalServices} services fully nominal
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Average Latency
              </CardTitle>
              <Zap className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {overview.avgLatencyMs}{' '}
                <span className="text-sm font-normal text-slate-500">ms</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Cross-service weighted P95</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Max Error Rate
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {overview.maxErrorRatePct.toFixed(1)}%
              </div>
              <p className="text-xs text-slate-500 mt-1">Highest node error rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Active Alerts
              </CardTitle>
              <Bell className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {overview.activeAlertsCount}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {overview.activeAlertsCount === 0
                  ? 'No open incidents'
                  : 'Requires engineering attention'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Incident / Alert Banners */}
      {alertTriggers.length > 0 && (
        <div className="space-y-2">
          {alertTriggers.map((trg) => (
            <div
              key={trg.id}
              className={`flex items-start justify-between rounded-lg border p-4 text-sm ${
                trg.severity === 'critical'
                  ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200'
                  : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <span>{trg.ruleName}</span>
                    <Badge variant={trg.severity === 'critical' ? 'destructive' : 'warning'}>
                      {trg.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs">{trg.message}</p>
                </div>
              </div>
              <span className="text-xs opacity-75 shrink-0">
                {new Date(trg.triggeredAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'matrix'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400'
          }`}
        >
          <Server className="h-4 w-4" />
          Services Matrix ({services.length})
        </button>
        <button
          onClick={() => setActiveTab('ai_node')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'ai_node'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400'
          }`}
        >
          <Cpu className="h-4 w-4" />
          Self-Hosted AI Node
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'alerts'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400'
          }`}
        >
          <Bell className="h-4 w-4" />
          Alert Rules & Thresholds ({alertRules.length})
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* TAB 1: Services Matrix */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase mr-1">Filter:</span>
                {[
                  { id: 'all', label: 'All Services' },
                  { id: 'api', label: 'Core APIs' },
                  { id: 'infrastructure', label: 'Cloud & Database' },
                  { id: 'ai_provider', label: 'AI Providers' },
                  { id: 'ai_server', label: 'AI Servers' },
                  { id: 'worker', label: 'Background Workers' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      categoryFilter === cat.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {filteredServices.length === 0 ? (
                <EmptyState
                  title="No services match category filter"
                  description="Adjust filter selection above to view services."
                  icon={<Server className="h-6 w-6" />}
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredServices.map((svc) => (
                    <Card key={svc.serviceId} className="flex flex-col justify-between">
                      <div>
                        <CardHeader className="flex flex-row items-start justify-between pb-2">
                          <div className="space-y-1">
                            <CardTitle className="text-sm font-semibold">
                              {svc.serviceName}
                            </CardTitle>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {svc.category.replace('_', ' ')}
                              </Badge>
                              {svc.region && (
                                <span className="text-[11px] text-slate-500 truncate max-w-[150px]">
                                  {svc.region}
                                </span>
                              )}
                            </div>
                          </div>
                          <StatusIndicator status={svc.status} />
                        </CardHeader>

                        <CardContent className="space-y-2 pt-2 text-xs border-t border-slate-100 dark:border-slate-800 mt-2">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Latency:</span>
                            <span
                              className={`font-semibold font-mono ${
                                svc.latencyMs > 800
                                  ? 'text-rose-600'
                                  : svc.latencyMs > 300
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                              }`}
                            >
                              {svc.latencyMs} ms
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">30d Uptime:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {svc.uptimePct30d}%
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Error Rate:</span>
                            <span
                              className={`font-semibold ${
                                svc.errorRatePct > 5.0
                                  ? 'text-rose-600'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {svc.errorRatePct.toFixed(1)}%
                            </span>
                          </div>

                          {svc.consecutiveFailures > 0 && (
                            <div className="flex justify-between items-center text-rose-600">
                              <span>Consecutive Failures:</span>
                              <span className="font-bold">{svc.consecutiveFailures}</span>
                            </div>
                          )}

                          {svc.errorMessage && (
                            <div className="rounded bg-rose-50 p-1.5 text-[11px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                              {svc.errorMessage}
                            </div>
                          )}

                          <div className="text-[10px] text-slate-400 pt-1">
                            Last probe: {new Date(svc.lastCheckedAt).toLocaleTimeString()}
                          </div>
                        </CardContent>
                      </div>

                      <div className="p-3 pt-0">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={probingServiceId === svc.serviceId}
                          onClick={() => handlePingSingle(svc.serviceId)}
                          className="w-full text-xs h-7 gap-1.5"
                        >
                          <Radio
                            className={`h-3.5 w-3.5 ${
                              probingServiceId === svc.serviceId
                                ? 'animate-pulse text-indigo-600'
                                : ''
                            }`}
                          />
                          {probingServiceId === svc.serviceId ? 'Probing...' : 'Ping Node'}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Self-Hosted AI Node */}
          {activeTab === 'ai_node' && aiMetrics && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-indigo-600" />
                      {aiMetrics.serverName}
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      Engine:{' '}
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        vLLM Inference Server
                      </span>{' '}
                      | Active Model:{' '}
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">
                        {aiMetrics.modelLoaded}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIndicator status={aiMetrics.status} />
                    <Badge
                      variant={
                        aiMetrics.status === 'healthy'
                          ? 'success'
                          : aiMetrics.status === 'degraded'
                            ? 'warning'
                            : 'destructive'
                      }
                    >
                      {aiMetrics.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Visual Compute Utilization Meters */}
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* GPU Compute */}
                    <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="flex justify-between items-center text-sm font-semibold">
                        <span className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-indigo-600" />
                          GPU Compute Utilization
                        </span>
                        <span
                          className={
                            aiMetrics.gpuUsagePct >= 85
                              ? 'text-rose-600'
                              : 'text-slate-900 dark:text-white'
                          }
                        >
                          {aiMetrics.gpuUsagePct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className={`h-full transition-all duration-500 ${
                            aiMetrics.gpuUsagePct >= 95
                              ? 'bg-rose-600'
                              : aiMetrics.gpuUsagePct >= 85
                                ? 'bg-amber-500'
                                : 'bg-indigo-600'
                          }`}
                          style={{ width: `${Math.min(aiMetrics.gpuUsagePct, 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Accelerator: NVIDIA A100-SXM4-80GB (PCIe 4.0)
                      </span>
                    </div>

                    {/* VRAM Memory */}
                    <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="flex justify-between items-center text-sm font-semibold">
                        <span className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-emerald-600" />
                          VRAM High-Bandwidth Allocation
                        </span>
                        <span
                          className={
                            (aiMetrics.vramUsedMb / aiMetrics.vramTotalMb) * 100 >= 90
                              ? 'text-rose-600'
                              : 'text-slate-900 dark:text-white'
                          }
                        >
                          {((aiMetrics.vramUsedMb / aiMetrics.vramTotalMb) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className={`h-full transition-all duration-500 ${
                            aiMetrics.vramUsedMb / aiMetrics.vramTotalMb >= 0.95
                              ? 'bg-rose-600'
                              : aiMetrics.vramUsedMb / aiMetrics.vramTotalMb >= 0.9
                                ? 'bg-amber-500'
                                : 'bg-emerald-600'
                          }`}
                          style={{
                            width: `${Math.min((aiMetrics.vramUsedMb / aiMetrics.vramTotalMb) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {(aiMetrics.vramUsedMb / 1024).toFixed(1)} GB used of{' '}
                        {(aiMetrics.vramTotalMb / 1024).toFixed(1)} GB
                      </span>
                    </div>

                    {/* Host CPU */}
                    <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="flex justify-between items-center text-sm font-semibold">
                        <span className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-blue-600" />
                          Host CPU Load
                        </span>
                        <span>{aiMetrics.cpuUsagePct.toFixed(1)}%</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full bg-blue-600 transition-all duration-500"
                          style={{ width: `${Math.min(aiMetrics.cpuUsagePct, 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-500">
                        AMD EPYC 7763 64-Core Processor
                      </span>
                    </div>

                    {/* Host RAM */}
                    <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="flex justify-between items-center text-sm font-semibold">
                        <span className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-purple-600" />
                          Host System Memory
                        </span>
                        <span>
                          {((aiMetrics.memoryUsedMb / aiMetrics.memoryTotalMb) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full bg-purple-600 transition-all duration-500"
                          style={{
                            width: `${Math.min((aiMetrics.memoryUsedMb / aiMetrics.memoryTotalMb) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {(aiMetrics.memoryUsedMb / 1024).toFixed(1)} GB of{' '}
                        {(aiMetrics.memoryTotalMb / 1024).toFixed(1)} GB
                      </span>
                    </div>
                  </div>

                  {/* Runtime Throughput & Telemetry Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                    <div className="rounded-lg border border-slate-100 p-3 text-center dark:border-slate-800">
                      <div className="text-xl font-bold text-slate-900 dark:text-white">
                        {aiMetrics.queueDepth}
                      </div>
                      <div className="text-xs text-slate-500">Pending Queue Depth</div>
                    </div>
                    <div className="rounded-lg border border-slate-100 p-3 text-center dark:border-slate-800">
                      <div className="text-xl font-bold text-slate-900 dark:text-white">
                        {aiMetrics.activeStreams}
                      </div>
                      <div className="text-xs text-slate-500">Active Inference Streams</div>
                    </div>
                    <div className="rounded-lg border border-slate-100 p-3 text-center dark:border-slate-800">
                      <div className="text-xl font-bold text-slate-900 dark:text-white">
                        {aiMetrics.avgLatencyMs} ms
                      </div>
                      <div className="text-xs text-slate-500">Token Gen Latency</div>
                    </div>
                    <div className="rounded-lg border border-slate-100 p-3 text-center dark:border-slate-800">
                      <div className="text-xl font-bold text-emerald-600">
                        {aiMetrics.temperatureC}°C
                      </div>
                      <div className="text-xs text-slate-500">GPU Core Temp</div>
                    </div>
                  </div>

                  {/* Simulation / Testing Bar */}
                  <div className="rounded-lg border border-dashed border-slate-300 p-4 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          MLOps Simulation Controls
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Test alert triggering and dashboard responsiveness under simulated load.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => simulateAiServerLoad({ gpuUsagePct: 55.0, queueDepth: 4 })}
                        >
                          Nominal Load
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            simulateAiServerLoad({ gpuUsagePct: 88.0, queueDepth: 55 })
                          }
                          className="text-amber-600 border-amber-300 hover:bg-amber-50"
                        >
                          Simulate Warning (88% GPU)
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            simulateAiServerLoad({ gpuUsagePct: 98.0, queueDepth: 120 })
                          }
                          className="text-rose-600 border-rose-300 hover:bg-rose-50"
                        >
                          Simulate Critical (98% GPU)
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 3: Alert Rules & Thresholds */}
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Configured Infrastructure Alert Rules
                  </h3>
                  <p className="text-xs text-slate-500">
                    Proactive thresholds evaluated continuously against heartbeat probes and compute
                    telemetry.
                  </p>
                </div>
                <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Alert Rule
                </Button>
              </div>

              <Card>
                <Table>
                  <thead>
                    <tr>
                      <th>Rule Name</th>
                      <th>Target Service</th>
                      <th>Metric</th>
                      <th>Threshold</th>
                      <th>Severity</th>
                      <th>Email Notification</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertRules.map((rule) => (
                      <tr key={rule.id}>
                        <td className="font-semibold text-slate-900 dark:text-white">
                          {rule.name}
                        </td>
                        <td>
                          <Badge variant="outline" className="font-mono text-xs">
                            {rule.targetServiceId}
                          </Badge>
                        </td>
                        <td className="capitalize text-xs text-slate-600 dark:text-slate-400">
                          {rule.metric.replace(/_/g, ' ')}
                        </td>
                        <td className="font-mono font-semibold">
                          {rule.threshold}
                          {rule.metric.includes('pct')
                            ? '%'
                            : rule.metric.includes('ms')
                              ? ' ms'
                              : ''}
                        </td>
                        <td>
                          <Badge variant={rule.severity === 'critical' ? 'destructive' : 'warning'}>
                            {rule.severity.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="text-xs text-slate-500">
                          {rule.notifyEmails.length > 0 ? rule.notifyEmails.join(', ') : 'None'}
                        </td>
                        <td>
                          <button
                            onClick={() => handleToggleRule(rule.id, rule.enabled)}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                              rule.enabled
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete Rule"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Create Alert Rule Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create Infrastructure Alert Rule"
        >
          <form onSubmit={handleCreateRule} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Rule Name
              </label>
              <input
                type="text"
                required
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                placeholder="e.g. AI Gateway Latency Warning"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Service
                </label>
                <select
                  value={newRuleTarget}
                  onChange={(e) => setNewRuleTarget(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="all">All Services (Global)</option>
                  {services.map((svc) => (
                    <option key={svc.serviceId} value={svc.serviceId}>
                      {svc.serviceName}
                    </option>
                  ))}
                  <option value="self_hosted">Self-Hosted AI Node</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Metric
                </label>
                <select
                  value={newRuleMetric}
                  onChange={(e) => setNewRuleMetric(e.target.value as InfrastructureAlertMetric)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="latency_ms">Latency (ms)</option>
                  <option value="error_rate_pct">Error Rate (%)</option>
                  <option value="consecutive_failures">Consecutive Failures</option>
                  <option value="gpu_usage_pct">GPU Utilization (%)</option>
                  <option value="vram_usage_pct">VRAM Utilization (%)</option>
                  <option value="queue_depth">Queue Depth (Requests)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Threshold Value
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={newRuleThreshold}
                  onChange={(e) => setNewRuleThreshold(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Severity Level
                </label>
                <select
                  value={newRuleSeverity}
                  onChange={(e) =>
                    setNewRuleSeverity(e.target.value as InfrastructureAlertSeverity)
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notification Emails (comma-separated)
              </label>
              <input
                type="text"
                value={newRuleEmails}
                onChange={(e) => setNewRuleEmails(e.target.value)}
                placeholder="ops@webappypie.com, oncall@webappypie.com"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingRule}>
                {savingRule ? 'Saving...' : 'Create Rule'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
