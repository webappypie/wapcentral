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
  Lock,
  Globe,
  Radio,
  Clock,
  Layers,
} from 'lucide-react';
import type {
  DetailedServiceHealth,
  InfrastructureAlertRule,
  InfrastructureAlertTrigger,
  InfrastructureOverviewReport,
  PlatformHealthOverview,
  InfrastructureAlertMetric,
  InfrastructureAlertSeverity,
} from '@wapcentral/types';
import {
  subscribePlatformHealth,
  subscribeInfrastructureAlerts,
  triggerServiceHealthCheck,
  fetchInfrastructureReport,
  createInfrastructureAlertRule,
  toggleInfrastructureAlertRule,
  deleteInfrastructureAlertRule,
} from '../services/infrastructureService.js';
import { useAuth } from '../contexts/AuthContext.js';

type Tab = 'matrix' | 'cloud_resources' | 'alerts';

export const InfrastructurePage: React.FC = () => {
  const { user } = useAuth();
  const actor = {
    uid: user?.uid ?? 'usr_admin_default',
    email: user?.email ?? 'admin@webappypie.com',
  };

  const [activeTab, setActiveTab] = useState<Tab>('matrix');
  const [services, setServices] = useState<DetailedServiceHealth[]>([]);
  const [overview, setOverview] = useState<PlatformHealthOverview | null>(null);
  const [fullReport, setFullReport] = useState<InfrastructureOverviewReport | null>(null);
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
  const [newRuleThreshold, setNewRuleThreshold] = useState('500');
  const [newRuleSeverity, setNewRuleSeverity] = useState<InfrastructureAlertSeverity>('warning');
  const [newRuleEmails, setNewRuleEmails] = useState('');
  const [savingRule, setSavingRule] = useState(false);

  useEffect(() => {
    setLoading(true);

    const unsubHealth = subscribePlatformHealth(
      (loadedServices, loadedOverview, loadedReport) => {
        setServices(loadedServices);
        setOverview(loadedOverview);
        if (loadedReport) {
          setFullReport(loadedReport);
        }
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );

    const unsubAlerts = subscribeInfrastructureAlerts((rules, triggers) => {
      setAlertRules(rules);
      setAlertTriggers(triggers);
    });

    return () => {
      unsubHealth();
      unsubAlerts();
    };
  }, []);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await triggerServiceHealthCheck();
      const updated = await fetchInfrastructureReport();
      setFullReport(updated);
      setServices(updated.services);
      setOverview({
        overallStatus: updated.overallStatus,
        healthyCount: updated.summary.healthyCount,
        degradedCount: updated.summary.degradedCount,
        unhealthyCount: updated.summary.unhealthyCount,
        totalServices: updated.summary.totalServices,
        avgLatencyMs: updated.summary.avgLatencyMs,
        maxErrorRatePct: updated.summary.maxErrorRatePct,
        activeAlertsCount: updated.summary.activeAlertsCount,
        lastCheckedAt: updated.generatedAt,
      });
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePingSingle = async (serviceId: string) => {
    setProbingServiceId(serviceId);
    try {
      await triggerServiceHealthCheck(serviceId);
      await handleRefreshAll();
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

      const created = await createInfrastructureAlertRule(
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

      setAlertRules((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setNewRuleName('');
      setNewRuleEmails('');
    } finally {
      setSavingRule(false);
    }
  };

  const handleToggleRule = async (ruleId: string, currentEnabled: boolean) => {
    await toggleInfrastructureAlertRule(ruleId, !currentEnabled, actor);
    setAlertRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !currentEnabled } : r)),
    );
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (confirm('Are you sure you want to delete this infrastructure alert rule?')) {
      await deleteInfrastructureAlertRule(ruleId, actor);
      setAlertRules((prev) => prev.filter((r) => r.id !== ruleId));
    }
  };

  const filteredServices = services.filter((svc) => {
    if (categoryFilter === 'all') return true;
    return svc.category === categoryFilter;
  });

  const formatUptime = (seconds?: number): string => {
    if (!seconds) return 'Not available';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Infrastructure Health & Telemetry"
        description="Continuous heartbeat monitoring across Google Cloud Run, Firestore, Secret Manager, Cloud Scheduler, and AI routing."
        actions={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Production Live
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
                {overview.healthyCount} of {overview.totalServices} services nominal
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Cloud Run Revision
              </CardTitle>
              <Layers className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold font-mono text-slate-900 dark:text-white truncate">
                {fullReport?.cloudRun?.[0]?.latestRevision || 'wapcentral-admin-api'}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px]">
                  {fullReport?.cloudRun?.[0]?.region || 'asia-south1'}
                </Badge>
                <span className="text-xs text-emerald-600 font-medium">100% Traffic</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Firestore Database
              </CardTitle>
              <Database className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {fullReport?.firestore?.latencyMs ?? overview.avgLatencyMs}{' '}
                <span className="text-sm font-normal text-slate-500">ms</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Project: {fullReport?.firestore?.projectId || 'wapcentral-prod'} (nam5)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Secret Manager Vault
              </CardTitle>
              <Lock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {fullReport?.secretManager?.totalConfigured ?? 5}{' '}
                <span className="text-sm font-normal text-slate-500">
                  / {fullReport?.secretManager?.totalTracked ?? 5}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">GCP Envelope Encryption Active</p>
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
          Production Services Matrix ({services.length})
        </button>
        <button
          onClick={() => setActiveTab('cloud_resources')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'cloud_resources'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400'
          }`}
        >
          <Cpu className="h-4 w-4" />
          Cloud Resources & Runtime
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

          {/* TAB 2: Cloud Resources & Runtime */}
          {activeTab === 'cloud_resources' && (
            <div className="space-y-6">
              {/* Cloud Run Container Details */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Server className="h-5 w-5 text-indigo-600" />
                        Google Cloud Run Service Runtime
                      </CardTitle>
                      <p className="text-xs text-slate-500">
                        Container infrastructure deployed in asia-south1 (Mumbai) serving production traffic.
                      </p>
                    </div>
                    <Badge variant="success">PRODUCTION READY</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-slate-100 p-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="text-xs font-medium text-slate-500">Active Revision</div>
                      <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1 truncate">
                        {fullReport?.cloudRun?.[0]?.latestRevision || 'wapcentral-admin-api'}
                      </div>
                      <div className="text-[11px] text-emerald-600 mt-1">100% Traffic Serving</div>
                    </div>

                    <div className="rounded-lg border border-slate-100 p-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="text-xs font-medium text-slate-500">Process Heap Memory</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                        {fullReport?.systemProcess?.heapUsedMb ?? 'Not available'}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          / {fullReport?.systemProcess?.heapTotalMb ?? 'Not available'} MB
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        RSS: {fullReport?.systemProcess?.rssMb ?? 'Not available'} MB
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-100 p-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="text-xs font-medium text-slate-500">Runtime Container Uptime</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                        {formatUptime(fullReport?.systemProcess?.uptimeSeconds)}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Node: {fullReport?.systemProcess?.nodeVersion || 'v24'} ({fullReport?.systemProcess?.platform || 'linux'})
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-100 p-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="text-xs font-medium text-slate-500">Scaling & Ingress</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                        Max Scale: {fullReport?.cloudRun?.[0]?.maxScale ?? 20} Instances
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">Ingress: All Traffic</div>
                    </div>
                  </div>

                  {/* Secret Manager and Scheduler Status Details */}
                  <div className="grid gap-4 md:grid-cols-2 pt-2">
                    <div className="rounded-lg border border-slate-100 p-4 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Lock className="h-4 w-4 text-amber-500" />
                          Secret Manager Key Vault
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {fullReport?.secretManager?.totalConfigured || 5} Active Keys
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">
                        Encrypted cryptographic secrets with automatic replication. Secret values remain strictly server-side and are never transmitted to clients.
                      </p>
                      <div className="space-y-1.5">
                        {(fullReport?.secretManager?.secrets || []).map((sec) => (
                          <div
                            key={sec.name}
                            className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-50 dark:bg-slate-900/80"
                          >
                            <span className="font-mono text-slate-700 dark:text-slate-300">
                              {sec.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 capitalize">
                                {sec.replication}
                              </span>
                              <Badge
                                variant={sec.configured ? 'success' : 'secondary'}
                                className="text-[9px]"
                              >
                                {sec.state}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-100 p-4 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-blue-500" />
                          Cloud Scheduler Jobs
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {fullReport?.cloudScheduler?.totalJobs || 0} Scheduled Jobs
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">
                        {fullReport?.cloudScheduler?.note ||
                          'Background tasks run via continuous serverless worker processes.'}
                      </p>
                      {fullReport?.cloudScheduler?.jobs && fullReport.cloudScheduler.jobs.length > 0 ? (
                        <div className="space-y-1.5">
                          {fullReport.cloudScheduler.jobs.map((job) => (
                            <div
                              key={job.jobId}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-50 dark:bg-slate-900/80"
                            >
                              <span className="font-mono text-slate-700 dark:text-slate-300">
                                {job.name}
                              </span>
                              <span className="text-[10px] text-slate-400">{job.schedule}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded border border-dashed border-slate-200 dark:border-slate-800 p-3 text-center text-xs text-slate-400">
                          No cron scheduler jobs active in region asia-south1.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Self-Hosted Node State (Production Reality) */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-slate-400" />
                      Self-Hosted AI Inference Node
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                      Dedicated self-hosted GPU inference engine status (vLLM / Triton / Ollama).
                    </p>
                  </div>
                  <Badge variant="secondary">NOT CONFIGURED (SERVERLESS)</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                    <div className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      Serverless Architecture Notice
                    </div>
                    <p className="mt-1">
                      WAPCentral is currently deployed on Google Cloud Run serverless container infrastructure.
                      No self-hosted GPU node is attached. AI inference requests are routed through verified official cloud providers (OpenAI, Google Gemini, Anthropic).
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-slate-100 p-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50 text-center">
                      <div className="text-xs text-slate-500">GPU Accelerator</div>
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
                        Not available
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">No GPU attached</div>
                    </div>

                    <div className="rounded-lg border border-slate-100 p-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50 text-center">
                      <div className="text-xs text-slate-500">GPU Compute Load</div>
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
                        Not available
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Offline / Unconfigured</div>
                    </div>

                    <div className="rounded-lg border border-slate-100 p-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50 text-center">
                      <div className="text-xs text-slate-500">VRAM Allocation</div>
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
                        Not available
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">0 GB allocated</div>
                    </div>

                    <div className="rounded-lg border border-slate-100 p-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50 text-center">
                      <div className="text-xs text-slate-500">GPU Core Temp</div>
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
                        Not available
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Sensor offline</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 3: Alert Rules & Thresholds */}
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Operational Alert Rules
                  </h3>
                  <p className="text-xs text-slate-500">
                    Thresholds evaluated automatically against real production service health and latency.
                  </p>
                </div>
                <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Alert Rule
                </Button>
              </div>

              {alertRules.length === 0 ? (
                <EmptyState
                  title="No alert rules configured"
                  description="Create an alert rule to automatically monitor latency or connectivity failures."
                  icon={<Bell className="h-6 w-6" />}
                  actionLabel="Create First Rule"
                  onAction={() => setIsModalOpen(true)}
                />
              ) : (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950">
                  <Table>
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-left text-xs font-medium text-slate-500">
                        <th className="p-3">Rule Name</th>
                        <th className="p-3">Target Service</th>
                        <th className="p-3">Metric</th>
                        <th className="p-3">Threshold</th>
                        <th className="p-3">Severity</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {alertRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                          <td className="p-3 font-medium text-slate-900 dark:text-white">
                            {rule.name}
                          </td>
                          <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                            {rule.targetServiceId}
                          </td>
                          <td className="p-3 capitalize">{rule.metric.replace('_', ' ')}</td>
                          <td className="p-3 font-mono font-semibold">
                            {rule.threshold}
                            {rule.metric.includes('pct')
                              ? '%'
                              : rule.metric.includes('ms')
                                ? ' ms'
                                : ''}
                          </td>
                          <td className="p-3">
                            <Badge variant={rule.severity === 'critical' ? 'destructive' : 'warning'}>
                              {rule.severity.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => handleToggleRule(rule.id, rule.enabled)}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                rule.enabled
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {rule.enabled ? 'Enabled' : 'Disabled'}
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                              title="Delete Rule"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal: Create Alert Rule */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Infrastructure Alert Rule"
      >
        <form onSubmit={handleCreateRule} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Rule Name *
            </label>
            <input
              type="text"
              required
              value={newRuleName}
              onChange={(e) => setNewRuleName(e.target.value)}
              placeholder="e.g. Core API High Latency"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Service
              </label>
              <select
                value={newRuleTarget}
                onChange={(e) => setNewRuleTarget(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="all">All Monitored Services</option>
                {services.map((s) => (
                  <option key={s.serviceId} value={s.serviceId}>
                    {s.serviceName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Monitored Metric
              </label>
              <select
                value={newRuleMetric}
                onChange={(e) => setNewRuleMetric(e.target.value as InfrastructureAlertMetric)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="latency_ms">Latency (ms)</option>
                <option value="consecutive_failures">Consecutive Failures</option>
                <option value="error_rate_pct">Error Rate (%)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Threshold Value *
              </label>
              <input
                type="number"
                required
                min="1"
                value={newRuleThreshold}
                onChange={(e) => setNewRuleThreshold(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Severity Level
              </label>
              <select
                value={newRuleSeverity}
                onChange={(e) => setNewRuleSeverity(e.target.value as InfrastructureAlertSeverity)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Notification Emails (comma-separated)
            </label>
            <input
              type="text"
              value={newRuleEmails}
              onChange={(e) => setNewRuleEmails(e.target.value)}
              placeholder="ops@webappypie.com, admin@webappypie.com"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingRule}>
              {savingRule ? 'Saving...' : 'Save Alert Rule'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
