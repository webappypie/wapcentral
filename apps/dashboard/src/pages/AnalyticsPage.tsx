import React, { useState, useEffect } from 'react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Spinner,
  EmptyState,
  ErrorState,
  Button,
  Modal,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@wapcentral/ui';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Cpu,
  AlertTriangle,
  Clock,
  Trash2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import type {
  UsageAggregationSummary,
  CampaignPerformance,
  CostAlertRule,
  CostAlertTrigger,
  DataRetentionPolicy,
  AlertMetricType,
} from '@wapcentral/types';
import {
  subscribeUsageAnalytics,
  subscribeCampaignAnalytics,
  subscribeCostAlerts,
  createCostAlertRule,
  toggleCostAlertRule,
  deleteCostAlertRule,
  subscribeDataRetentionPolicy,
  updateDataRetentionPolicy,
  triggerManualRetentionPruning,
} from '../services/analyticsService.js';
import { useAuth } from '../contexts/AuthContext.js';

type ViewState = 'content' | 'loading' | 'empty' | 'error';
type ActiveTab = 'ai' | 'promotions' | 'alerts' | 'retention';

export const AnalyticsPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');
  const [activeTab, setActiveTab] = useState<ActiveTab>('ai');
  const [timeRangeDays, setTimeRangeDays] = useState<number>(30);

  // Analytics data states
  const [usageSummary, setUsageSummary] = useState<UsageAggregationSummary | null>(null);
  const [campaignStats, setCampaignStats] = useState<CampaignPerformance[]>([]);
  const [alertRules, setAlertRules] = useState<CostAlertRule[]>([]);
  const [activeTriggers, setActiveTriggers] = useState<CostAlertTrigger[]>([]);
  const [retentionPolicy, setRetentionPolicy] = useState<DataRetentionPolicy | null>(null);

  // Modal & form states
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleMetric, setNewRuleMetric] = useState<AlertMetricType>('daily_cost_usd');
  const [newRuleThreshold, setNewRuleThreshold] = useState<number>(10.0);
  const [newRuleAppId, setNewRuleAppId] = useState<string>('');
  const [newRuleEmails, setNewRuleEmails] = useState<string>('ops@webappypie.com');

  // Retention edit state
  const [editUsageTtl, setEditUsageTtl] = useState(90);
  const [editPromoTtl, setEditPromoTtl] = useState(90);
  const [isPruning, setIsPruning] = useState(false);
  const [pruneResult, setPruneResult] = useState<{ prunedCount: number; timestamp: string } | null>(
    null,
  );
  const [saveRetentionSuccess, setSaveRetentionSuccess] = useState(false);

  const { user, hasRole } = useAuth();

  useEffect(() => {
    const unsubUsage = subscribeUsageAnalytics(
      timeRangeDays,
      (summary) => setUsageSummary(summary),
      () => setViewState('error'),
    );

    const unsubCamp = subscribeCampaignAnalytics(
      (perf) => setCampaignStats(perf),
      () => setViewState('error'),
    );

    const unsubAlerts = subscribeCostAlerts(
      (rules, triggers) => {
        setAlertRules(rules);
        setActiveTriggers(triggers);
      },
      () => setViewState('error'),
    );

    const unsubRetention = subscribeDataRetentionPolicy((policy) => {
      setRetentionPolicy(policy);
      setEditUsageTtl(policy.usageEventsTtlDays);
      setEditPromoTtl(policy.promotionEventsTtlDays);
    });

    return () => {
      unsubUsage();
      unsubCamp();
      unsubAlerts();
      unsubRetention();
    };
  }, [timeRangeDays]);

  const handleCreateAlertRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || newRuleThreshold <= 0) return;

    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };

    const emails = newRuleEmails
      .split(',')
      .map((em) => em.trim())
      .filter((em) => em.length > 0);

    await createCostAlertRule(
      {
        name: newRuleName.trim(),
        metric: newRuleMetric,
        threshold: Number(newRuleThreshold),
        ...(newRuleAppId.trim() ? { appId: newRuleAppId.trim() } : {}),
        notifyEmails: emails,
        enabled: true,
      },
      actor,
    );

    setNewRuleName('');
    setIsAlertModalOpen(false);
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };
    await toggleCostAlertRule(ruleId, enabled, actor);
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (window.confirm('Are you sure you want to delete this alert rule?')) {
      const actor = {
        uid: user?.uid || 'usr_admin',
        email: user?.email || 'admin@webappypie.com',
      };
      await deleteCostAlertRule(ruleId, actor);
    }
  };

  const handleSaveRetention = async () => {
    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };
    await updateDataRetentionPolicy(
      {
        usageEventsTtlDays: editUsageTtl,
        promotionEventsTtlDays: editPromoTtl,
        auditLogsTtlDays: retentionPolicy?.auditLogsTtlDays || 365,
      },
      actor,
    );
    setSaveRetentionSuccess(true);
    setTimeout(() => setSaveRetentionSuccess(false), 3000);
  };

  const handleRunPruning = async () => {
    setIsPruning(true);
    try {
      const actor = {
        uid: user?.uid || 'usr_admin',
        email: user?.email || 'admin@webappypie.com',
      };
      const result = await triggerManualRetentionPruning(actor);
      setPruneResult(result);
    } finally {
      setIsPruning(false);
    }
  };

  const formatTokens = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return String(num);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usage & Cost Analytics"
        description="Daily token consumption, estimated provider costs, and promotion delivery throughput"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 text-xs dark:border-slate-800 dark:bg-slate-900">
              <button
                onClick={() => setActiveTab('ai')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  activeTab === 'ai'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                AI Usage & Cost
              </button>
              <button
                onClick={() => setActiveTab('promotions')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  activeTab === 'promotions'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                Promotion Analytics
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors ${
                  activeTab === 'alerts'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                Cost Alerts
                {activeTriggers.length > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {activeTriggers.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('retention')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  activeTab === 'retention'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                Data Retention
              </button>
            </div>

            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 text-xs dark:border-slate-800 dark:bg-slate-900">
              {(['content', 'loading', 'empty', 'error'] as ViewState[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setViewState(s)}
                  className={`rounded px-2 py-1 capitalize transition-colors ${
                    viewState === s
                      ? 'bg-indigo-600 font-semibold text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {viewState === 'loading' && (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {viewState === 'empty' && (
        <EmptyState
          title="No analytics recorded yet"
          description="Analytics will aggregate automatically as mobile apps generate traffic."
          icon={<BarChart3 className="h-6 w-6" />}
          actionLabel="Refresh Analytics"
          onAction={() => setViewState('content')}
        />
      )}

      {viewState === 'error' && (
        <ErrorState
          title="Failed to load analytics"
          message="Could not load daily usage aggregations."
          onRetry={() => setViewState('content')}
        />
      )}

      {/* Global Alert Notification Banner */}
      {activeTriggers.length > 0 && (
        <div className="space-y-2">
          {activeTriggers.map((t) => (
            <div
              key={t.id}
              className={`flex items-center justify-between rounded-lg border p-3 text-xs ${
                t.severity === 'critical'
                  ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300'
                  : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={`h-4 w-4 ${t.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`}
                />
                <span className="font-semibold uppercase tracking-wider text-[11px]">
                  {t.severity}:
                </span>
                <span>{t.message}</span>
              </div>
              <span className="text-[11px] opacity-75">
                Metric: {t.metric.replace(/_/g, ' ')} | Triggered: {t.triggeredAt.split('T')[0]}
              </span>
            </div>
          ))}
        </div>
      )}

      {viewState === 'content' && activeTab === 'ai' && usageSummary && (
        <div className="space-y-6">
          {/* Time Range Selector & Disclaimers */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <Calendar className="h-4 w-4 text-indigo-500" />
              <span className="font-medium">Aggregation Window:</span>
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRangeDays(days)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    timeRangeDays === days
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  Last {days} Days
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Badge
                variant="outline"
                className="border-amber-300 text-amber-700 dark:text-amber-400"
              >
                ESTIMATE (USD)
              </Badge>
              <span>Calculated based on standard token pricing cards</span>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Estimated AI Spend</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${usageSummary.totalCostEstimateUsd.toFixed(2)}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                  <span className="font-medium text-emerald-600">ESTIMATE</span>
                  <span>({timeRangeDays} day window)</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Tokens Consumed</CardTitle>
                <Cpu className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatTokens(usageSummary.totalTokens)}</div>
                <p className="text-xs text-slate-500 mt-1">
                  In: {formatTokens(usageSummary.totalInputTokens)} | Out:{' '}
                  {formatTokens(usageSummary.totalOutputTokens)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total AI Requests</CardTitle>
                <BarChart3 className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {usageSummary.totalRequests.toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Avg Latency: {usageSummary.avgLatencyMs}ms
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{usageSummary.errorRatePct}%</div>
                <p className="text-xs text-slate-500 mt-1">
                  {usageSummary.totalErrors} failed requests
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Spend & Token Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Daily Usage & Spend Trendlines</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Day-by-day AI query volume and estimated expenditure
              </p>
            </CardHeader>
            <CardContent>
              {usageSummary.dailyTrends.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No daily records for this time range.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex h-36 items-end gap-1.5 pt-4">
                    {usageSummary.dailyTrends.map((t) => {
                      const maxCost = Math.max(
                        ...usageSummary.dailyTrends.map((d) => d.costEstimateUsd),
                        0.01,
                      );
                      const heightPct = Math.min(
                        100,
                        Math.max(10, (t.costEstimateUsd / maxCost) * 100),
                      );

                      return (
                        <div
                          key={t.date}
                          className="group relative flex flex-1 flex-col items-center h-full justify-end"
                        >
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="w-full rounded-t bg-indigo-500/80 hover:bg-indigo-600 transition-all"
                          />
                          <span className="mt-1 text-[9px] text-slate-400 rotate-45 origin-left">
                            {t.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 pt-3 border-t">
                    <span>Date: {usageSummary.dailyTrends[0]?.date}</span>
                    <span className="text-indigo-600 font-medium">Daily Spend (USD)</span>
                    <span>
                      Date: {usageSummary.dailyTrends[usageSummary.dailyTrends.length - 1]?.date}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Breakdown Tables: By Provider & By App */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">AI Provider Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Spend (USD)</TableHead>
                      <TableHead className="text-right">Latency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(usageSummary.byProvider).map(([providerId, data]) => (
                      <TableRow key={providerId}>
                        <TableCell className="font-semibold capitalize">{providerId}</TableCell>
                        <TableCell className="text-right">{data.requests}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatTokens(data.tokens)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          ${data.costEstimateUsd.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-500">
                          {data.avgLatencyMs}ms
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Application Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>App ID</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Spend (USD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(usageSummary.byApp).map(([appId, data]) => (
                      <TableRow key={appId}>
                        <TableCell className="font-mono text-xs font-semibold">{appId}</TableCell>
                        <TableCell className="text-right">{data.requests}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatTokens(data.tokens)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          ${data.costEstimateUsd.toFixed(4)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Promotion Analytics */}
      {viewState === 'content' && activeTab === 'promotions' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
                <TrendingUp className="h-4 w-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {campaignStats.reduce((acc, c) => acc + c.impressions, 0).toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 mt-1">Cross-app promo displays</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                <BarChart3 className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {campaignStats.reduce((acc, c) => acc + c.clicks, 0).toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 mt-1">User conversion click actions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Network CTR</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(
                    (campaignStats.reduce((acc, c) => acc + c.clicks, 0) /
                      Math.max(
                        1,
                        campaignStats.reduce((acc, c) => acc + c.impressions, 0),
                      )) *
                    100
                  ).toFixed(2)}
                  %
                </div>
                <p className="text-xs text-slate-500 mt-1">Average conversion efficiency</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Campaign Delivery & Conversion Performance
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time impression count, click conversions, and calculated CTR %
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign Name</TableHead>
                    <TableHead>Promoted App</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignStats.map((camp) => (
                    <TableRow key={camp.campaignId}>
                      <TableCell className="font-semibold">{camp.campaignName}</TableCell>
                      <TableCell className="font-mono text-xs">{camp.promotedAppId}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {camp.layoutVariant}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {camp.impressions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {camp.clicks.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-indigo-600">
                        {camp.ctr}%
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={camp.status === 'published' ? 'success' : 'default'}
                          className="text-[10px]"
                        >
                          {camp.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 3: Cost Alerts */}
      {viewState === 'content' && activeTab === 'alerts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Configured Budget & Quota Alert Rules
              </h3>
              <p className="text-xs text-slate-500">
                Monitors daily spend, token ceilings, and error rates to prevent billing surprises.
              </p>
            </div>
            {hasRole('editor') && (
              <Button size="sm" onClick={() => setIsAlertModalOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Alert Rule
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule Name</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                    <TableHead>Notifications</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    {hasRole('editor') && (
                      <TableHead className="w-16 text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-slate-500 text-xs">
                        No alert rules configured. Click "Add Alert Rule" to define spend caps.
                      </TableCell>
                    </TableRow>
                  ) : (
                    alertRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-semibold">{rule.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {rule.metric.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 font-mono">
                          {rule.appId || 'GLOBAL'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-800 dark:text-slate-200">
                          {rule.metric.includes('cost') ? `$${rule.threshold}` : rule.threshold}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {rule.notifyEmails.join(', ')}
                        </TableCell>
                        <TableCell className="text-center">
                          {hasRole('editor') ? (
                            <button
                              onClick={() => handleToggleRule(rule.id, !rule.enabled)}
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                                rule.enabled
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {rule.enabled ? 'Enabled' : 'Disabled'}
                            </button>
                          ) : (
                            <Badge
                              variant={rule.enabled ? 'success' : 'default'}
                              className="text-[10px]"
                            >
                              {rule.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          )}
                        </TableCell>
                        {hasRole('editor') && (
                          <TableCell className="text-right">
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                              title="Delete Rule"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 4: Data Retention Policy */}
      {viewState === 'content' && activeTab === 'retention' && retentionPolicy && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-500" />
                  <CardTitle className="text-sm">Configurable Retention TTL</CardTitle>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Raw event logs are automatically pruned after expiration. Summaries remain
                  permanently.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Raw AI Usage Events TTL (Days):
                  </label>
                  <input
                    type="number"
                    min={7}
                    max={365}
                    value={editUsageTtl}
                    disabled={!hasRole('editor')}
                    onChange={(e) => setEditUsageTtl(Number(e.target.value))}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Recommended: 90 days for operational debugging
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Promotion Impression & Click Events TTL (Days):
                  </label>
                  <input
                    type="number"
                    min={7}
                    max={365}
                    value={editPromoTtl}
                    disabled={!hasRole('editor')}
                    onChange={(e) => setEditPromoTtl(Number(e.target.value))}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Recommended: 90 days for conversion tracking
                  </p>
                </div>

                {hasRole('editor') && (
                  <div className="flex items-center justify-between pt-2">
                    {saveRetentionSuccess && (
                      <span className="flex items-center text-xs font-medium text-emerald-600">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Retention policy updated!
                      </span>
                    )}
                    <Button size="sm" onClick={handleSaveRetention} className="ml-auto">
                      Save Retention Policy
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-emerald-500" />
                  <CardTitle className="text-sm">Pruning Operations & Execution</CardTitle>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scheduled worker execution status and manual cleanup triggers
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Last Cleanup Run:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {retentionPolicy.lastPrunedAt
                        ? retentionPolicy.lastPrunedAt.split('T')[0]
                        : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cumulative Pruned Events:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {retentionPolicy.prunedCount?.toLocaleString() || 0} records
                    </span>
                  </div>
                </div>

                {pruneResult && (
                  <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Successfully pruned {pruneResult.prunedCount} expired usage records older than{' '}
                    {retentionPolicy.usageEventsTtlDays} days.
                  </div>
                )}

                {hasRole('editor') && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPruning}
                    onClick={handleRunPruning}
                    className="w-full"
                  >
                    {isPruning ? (
                      <Spinner size="sm" className="mr-1.5" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Execute Manual Pruning Cycle
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Add Alert Rule Modal */}
      <Modal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        title="Configure New Budget or Quota Alert Rule"
      >
        <form onSubmit={handleCreateAlertRule} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Alert Rule Label
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Reader Daily Spend Warning"
              value={newRuleName}
              onChange={(e) => setNewRuleName(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Target Metric
              </label>
              <select
                value={newRuleMetric}
                onChange={(e) => setNewRuleMetric(e.target.value as AlertMetricType)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="daily_cost_usd">Daily Cost (USD)</option>
                <option value="monthly_cost_usd">Monthly Cost (USD)</option>
                <option value="daily_tokens">Daily Tokens</option>
                <option value="monthly_tokens">Monthly Tokens</option>
                <option value="error_rate_pct">Error Rate (%)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Threshold Ceil
              </label>
              <input
                type="number"
                step="any"
                required
                min={0.001}
                value={newRuleThreshold}
                onChange={(e) => setNewRuleThreshold(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Application Scope (Optional, leave blank for Global)
            </label>
            <input
              type="text"
              placeholder="e.g. app_01"
              value={newRuleAppId}
              onChange={(e) => setNewRuleAppId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Notification Recipients (Comma separated)
            </label>
            <input
              type="text"
              required
              placeholder="ops@webappypie.com, admin@webappypie.com"
              value={newRuleEmails}
              onChange={(e) => setNewRuleEmails(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAlertModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Create Alert Rule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
