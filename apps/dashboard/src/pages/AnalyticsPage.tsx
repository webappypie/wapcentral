import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  CheckCircle2,
  Calendar,
  Layers,
  Activity,
  Filter,
  Download,
  FileSpreadsheet,
  FileJson,
  Bell,
  Smartphone,
  Eye,
  MousePointer,
  HelpCircle,
  Percent,
  PlayCircle,
} from 'lucide-react';
import type {
  UsageAggregationSummary,
  CampaignPerformance,
  CostAlertRule,
  CostAlertTrigger,
  DataRetentionPolicy,
  AlertMetricType,
  AnalyticsOverviewMetrics,
  AppAnalyticsMetrics,
  NetworkComparisonItem,
  FormatAnalyticsItem,
  PlacementAnalyticsItem,
  CustomAdsAnalyticsMetrics,
  NotificationAnalyticsSummary,
  TimeSeriesDataPoint,
  CostIntelligenceMetrics,
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
  type UsageAnalyticsFilters,
} from '../services/analyticsService.js';
import { AnalyticsIntelligenceService } from '../services/analyticsIntelligenceService.js';
import { useAuth } from '../contexts/AuthContext.js';

type SectionMode = 'revenue' | 'ai_platform';
type RevenueTab =
  | 'overview'
  | 'apps'
  | 'networks'
  | 'formats'
  | 'placements'
  | 'revenue'
  | 'custom_ads'
  | 'notifications'
  | 'export';
type AiTab = 'ai' | 'promotions' | 'alerts' | 'retention';
type PresetRange = 'today' | 'yesterday' | '7d' | '30d' | 'all';

export const AnalyticsPage: React.FC = () => {
  const [sectionMode, setSectionMode] = useState<SectionMode>('revenue');
  const [revenueTab, setRevenueTab] = useState<RevenueTab>('overview');
  const [aiTab, setAiTab] = useState<AiTab>('ai');

  // Filters for Step 4
  const [preset, setPreset] = useState<PresetRange>('7d');
  const [filterApp, setFilterApp] = useState<string>('all');
  const [filterProvider, setFilterProvider] = useState<string>('all');

  // Loading & error
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rollupStatus, setRollupStatus] = useState<string | null>(null);

  // Step 4 Data States
  const [overview, setOverview] = useState<AnalyticsOverviewMetrics | null>(null);
  const [appsData, setAppsData] = useState<AppAnalyticsMetrics[]>([]);
  const [networksData, setNetworksData] = useState<NetworkComparisonItem[]>([]);
  const [formatsData, setFormatsData] = useState<FormatAnalyticsItem[]>([]);
  const [placementsData, setPlacementsData] = useState<PlacementAnalyticsItem[]>([]);
  const [customAdsData, setCustomAdsData] = useState<CustomAdsAnalyticsMetrics | null>(null);
  const [notificationsData, setNotificationsData] = useState<NotificationAnalyticsSummary | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesDataPoint[]>([]);
  const [costIntel, setCostIntel] = useState<CostIntelligenceMetrics | null>(null);

  // Legacy AI / Alerts / Retention States
  const [timeRangeDays, setTimeRangeDays] = useState<number>(30);
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
  const [pruneResult, setPruneResult] = useState<{ prunedCount: number; timestamp: string } | null>(null);
  const [saveRetentionSuccess, setSaveRetentionSuccess] = useState(false);

  const { user, hasRole } = useAuth();

  const loadRevenueAnalytics = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const query = {
        preset,
        appId: filterApp !== 'all' ? filterApp : undefined,
        provider: filterProvider !== 'all' ? filterProvider : undefined,
      };

      const [ov, apps, nets, fmts, placs, cAds, notifs, ts, cost] = await Promise.all([
        AnalyticsIntelligenceService.getOverview(query),
        AnalyticsIntelligenceService.getApps(query),
        AnalyticsIntelligenceService.getNetworks(query),
        AnalyticsIntelligenceService.getFormats(query),
        AnalyticsIntelligenceService.getPlacements(query),
        AnalyticsIntelligenceService.getCustomAds(query),
        AnalyticsIntelligenceService.getNotifications(query),
        AnalyticsIntelligenceService.getTimeSeries(query),
        AnalyticsIntelligenceService.getCostIntelligence(),
      ]);

      setOverview(ov);
      setAppsData(apps);
      setNetworksData(nets);
      setFormatsData(fmts);
      setPlacementsData(placs);
      setCustomAdsData(cAds);
      setNotificationsData(notifs);
      setTimeSeries(ts);
      setCostIntel(cost);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  }, [preset, filterApp, filterProvider]);

  useEffect(() => {
    if (sectionMode === 'revenue') {
      loadRevenueAnalytics();
    }
  }, [sectionMode, loadRevenueAnalytics]);

  // Load AI / alerts when in AI mode
  useEffect(() => {
    if (sectionMode !== 'ai_platform') return;

    const unsubs: Array<() => void> = [];
    setIsLoading(true);

    const u1 = subscribeUsageAnalytics(
      timeRangeDays,
      (summary) => {
        setUsageSummary(summary);
        setIsLoading(false);
      },
      (err) => setErrorMessage(err.message),
      { appId: filterApp, providerId: filterProvider },
    );
    unsubs.push(u1);

    const u2 = subscribeCampaignAnalytics(
      (stats) => setCampaignStats(stats),
      (err) => console.warn(err),
    );
    unsubs.push(u2);

    const u3 = subscribeCostAlerts(
      (rules, triggers) => {
        setAlertRules(rules);
        setActiveTriggers(triggers);
      },
      (err) => console.warn(err),
    );
    unsubs.push(u3);

    const u4 = subscribeDataRetentionPolicy(
      (policy) => {
        setRetentionPolicy(policy);
        setEditUsageTtl(policy.usageEventsTtlDays);
        setEditPromoTtl(policy.promotionEventsTtlDays);
      },
      (err) => console.warn(err),
    );
    unsubs.push(u4);

    return () => unsubs.forEach((u) => u());
  }, [sectionMode, timeRangeDays, filterApp, filterProvider]);

  const resolveDates = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (preset === 'today') return { startDate: today, endDate: today };
    if (preset === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return { startDate: d.toISOString().slice(0, 10), endDate: d.toISOString().slice(0, 10) };
    }
    if (preset === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { startDate: d.toISOString().slice(0, 10), endDate: today };
    }
    if (preset === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { startDate: d.toISOString().slice(0, 10), endDate: today };
    }
    return { startDate: '2026-01-01', endDate: today };
  };

  const handleExportCsv = async () => {
    const dates = resolveDates();
    await AnalyticsIntelligenceService.exportData({
      startDate: dates.startDate,
      endDate: dates.endDate,
      appId: filterApp !== 'all' ? filterApp : undefined,
      provider: filterProvider !== 'all' ? filterProvider : undefined,
      type: 'csv',
    });
  };

  const handleExportJson = async () => {
    const dates = resolveDates();
    await AnalyticsIntelligenceService.exportData({
      startDate: dates.startDate,
      endDate: dates.endDate,
      appId: filterApp !== 'all' ? filterApp : undefined,
      provider: filterProvider !== 'all' ? filterProvider : undefined,
      type: 'json',
    });
  };

  const handleTriggerRollup = async () => {
    setRollupStatus('Executing aggregation...');
    const res = await AnalyticsIntelligenceService.triggerRollup();
    setRollupStatus(res.message);
    setTimeout(() => {
      setRollupStatus(null);
      loadRevenueAnalytics();
    }, 2000);
  };

  const actor = {
    uid: user?.uid || 'admin',
    email: user?.email || 'admin@webappypie.com',
  };

  // AI rule submission
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) return;

    try {
      await createCostAlertRule(
        {
          name: newRuleName.trim(),
          metric: newRuleMetric,
          threshold: newRuleThreshold,
          appId: newRuleAppId.trim() || undefined,
          notifyEmails: newRuleEmails.split(',').map((s) => s.trim()).filter(Boolean),
          enabled: true,
        },
        actor,
      );
      setIsAlertModalOpen(false);
      setNewRuleName('');
    } catch (err: any) {
      alert(`Error creating rule: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics & Revenue Intelligence"
        description="Centralized monetization, performance, telemetry, and revenue intelligence across WebAppyPie applications."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (sectionMode === 'revenue') loadRevenueAnalytics();
              }}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {sectionMode === 'revenue' && (
              <>
                <Button variant="outline" size="sm" onClick={handleExportCsv}>
                  <FileSpreadsheet className="w-4 h-4 mr-1 text-emerald-600" />
                  CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportJson}>
                  <FileJson className="w-4 h-4 mr-1 text-blue-600" />
                  JSON
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Top Section Mode Toggle */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setSectionMode('revenue')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            sectionMode === 'revenue'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Ads & Revenue Intelligence (Step 4)
        </button>
        <button
          onClick={() => setSectionMode('ai_platform')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            sectionMode === 'ai_platform'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Cpu className="w-4 h-4" />
          AI & Platform Intelligence
        </button>
      </div>

      {/* Error state */}
      {errorMessage && (
        <ErrorState
          title="Analytics Error"
          message={errorMessage}
          onRetry={loadRevenueAnalytics}
        />
      )}

      {/* SECTION 1: ADS & REVENUE INTELLIGENCE */}
      {sectionMode === 'revenue' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white border rounded-lg p-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase">Range:</span>
              {(['today', 'yesterday', '7d', '30d', 'all'] as PresetRange[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition ${
                    preset === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p === '7d' ? 'Last 7 Days' : p === '30d' ? 'Last 30 Days' : p.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500">App:</span>
                <select
                  value={filterApp}
                  onChange={(e) => setFilterApp(e.target.value)}
                  className="border rounded px-2 py-1 text-xs bg-white"
                >
                  <option value="all">All Apps</option>
                  <option value="filezen">FileZen</option>
                  <option value="optilens">OptiLens</option>
                </select>
              </div>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500">Network:</span>
                <select
                  value={filterProvider}
                  onChange={(e) => setFilterProvider(e.target.value)}
                  className="border rounded px-2 py-1 text-xs bg-white"
                >
                  <option value="all">All Networks</option>
                  <option value="admob">Google AdMob</option>
                  <option value="meta">Meta Audience Network</option>
                  <option value="applovin">AppLovin MAX</option>
                  <option value="custom_ads">Custom Ads</option>
                </select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerRollup}
                title="Aggregate daily rollups"
              >
                <Activity className="w-3.5 h-3.5 mr-1 text-purple-600" />
                Rollup
              </Button>
            </div>
          </div>

          {rollupStatus && (
            <div className="p-2 bg-purple-50 border border-purple-200 text-purple-700 text-xs rounded flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 animate-spin" />
              {rollupStatus}
            </div>
          )}

          {/* Strict Revenue Honesty Guarantee Alert */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold">Revenue Integrity Standard: </span>
              WAPCentral never fabricates or displays estimated dollar earnings for unverified ad networks.
              Provider reporting APIs (Google AdMob, Meta Audience Network, AppLovin MAX) require linked reporting API tokens before live financial earnings are synced.
              Ad network metrics (Requests, Impressions, Clicks, CTR, Fill Rate) reflect live client-side telemetry.
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex border-b border-gray-200 overflow-x-auto text-xs font-medium">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'apps', label: 'Apps' },
              { id: 'networks', label: 'Ad Networks' },
              { id: 'formats', label: 'Ad Formats' },
              { id: 'placements', label: 'Placements' },
              { id: 'revenue', label: 'Revenue & eCPM' },
              { id: 'custom_ads', label: 'Custom Ads' },
              { id: 'notifications', label: 'Notifications' },
              { id: 'export', label: 'Events & Export' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRevenueTab(tab.id as RevenueTab)}
                className={`px-4 py-2.5 whitespace-nowrap border-b-2 transition-colors ${
                  revenueTab === tab.id
                    ? 'border-blue-600 text-blue-600 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="p-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {revenueTab === 'overview' && overview && (
                <div className="space-y-6">
                  {/* Top Key Metrics Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          Impressions
                        </div>
                        <div className="text-xl font-bold mt-1">
                          {overview.totalImpressions.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Requests: {overview.totalRequests.toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                          <MousePointer className="w-3.5 h-3.5 text-indigo-600" />
                          Clicks
                        </div>
                        <div className="text-xl font-bold mt-1">
                          {overview.totalClicks.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Across all formats
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                          <Percent className="w-3.5 h-3.5 text-emerald-600" />
                          CTR
                        </div>
                        <div className="text-xl font-bold mt-1 text-emerald-600">
                          {overview.overallCtr}%
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Clicks / Impressions
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-purple-600" />
                          Fill Rate
                        </div>
                        <div className="text-xl font-bold mt-1 text-purple-600">
                          {overview.overallFillRate}%
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Ad delivery efficiency
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                          eCPM
                        </div>
                        <div className="text-sm font-semibold mt-1 text-amber-700">
                          Not connected
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Awaiting provider API
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
                          Fallback Rate
                        </div>
                        <div className="text-xl font-bold mt-1 text-teal-600">
                          {overview.fallbackRatePct}%
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {overview.fallbackCount} provider fallbacks
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Secondary Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-blue-600" />
                          Monetized Applications ({overview.activeAppsCount})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {appsData.map((app) => (
                          <div key={app.appId} className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded">
                            <div>
                              <div className="font-medium text-gray-900">{app.appName || app.appId}</div>
                              <div className="text-gray-400 text-[10px]">Top: {app.topFormat} ({app.topProvider})</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-gray-800">{app.impressions.toLocaleString()} imp</div>
                              <div className="text-[10px] text-emerald-600">{app.ctr}% CTR</div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-600" />
                          Ad Networks Health ({overview.activeNetworksCount})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {networksData.map((net) => (
                          <div key={net.provider} className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded">
                            <div>
                              <div className="font-medium text-gray-900">{net.name}</div>
                              <div className="text-[10px] text-gray-400">Fill: {net.fillRate}%</div>
                            </div>
                            <div className="text-right">
                              <Badge variant={net.status.status === 'healthy' ? 'success' : 'warning'}>
                                {net.status.status}
                              </Badge>
                              <div className="text-[10px] text-gray-400 mt-0.5">{net.impressions.toLocaleString()} imp</div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          Ad Delivery Reliability
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-xs">
                        <div className="flex justify-between p-2 bg-rose-50 rounded text-rose-800">
                          <span>Ad Failures & Timeouts</span>
                          <span className="font-bold">{overview.totalFailures.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-purple-50 rounded text-purple-800">
                          <span>Rewarded Ad Grants</span>
                          <span className="font-bold">{overview.totalRewards.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-blue-50 rounded text-blue-800">
                          <span>Waterfall Fallbacks Handled</span>
                          <span className="font-bold">{overview.fallbackCount.toLocaleString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Time Series Summary Chart/Bar */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold">Daily Impression & Click Progression</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {timeSeries.map((pt) => {
                          const maxImp = Math.max(...timeSeries.map((t) => t.impressions), 1);
                          const widthPct = Math.min(100, Math.round((pt.impressions / maxImp) * 100));

                          return (
                            <div key={pt.date} className="flex items-center gap-3 text-xs">
                              <span className="w-20 font-mono text-gray-500">{pt.date}</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                <div
                                  className="bg-blue-600 h-full rounded-full transition-all"
                                  style={{ width: `${widthPct}%` }}
                                />
                              </div>
                              <span className="w-24 text-right font-medium">
                                {pt.impressions.toLocaleString()} imp
                              </span>
                              <span className="w-16 text-right text-emerald-600 font-semibold">
                                {pt.clicks} clicks
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* TAB 2: APPS */}
              {revenueTab === 'apps' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Application Performance Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Application</TableHead>
                          <TableHead className="text-right">Requests</TableHead>
                          <TableHead className="text-right">Impressions</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Fill Rate</TableHead>
                          <TableHead className="text-right">Failures</TableHead>
                          <TableHead>Top Format</TableHead>
                          <TableHead>Top Network</TableHead>
                          <TableHead>Reported Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appsData.map((app) => (
                          <TableRow key={app.appId}>
                            <TableCell className="font-semibold">{app.appName || app.appId}</TableCell>
                            <TableCell className="text-right font-mono">{app.requests.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{app.impressions.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{app.clicks.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-600">{app.ctr}%</TableCell>
                            <TableCell className="text-right font-bold text-purple-600">{app.fillRate}%</TableCell>
                            <TableCell className="text-right text-rose-600">{app.failures.toLocaleString()}</TableCell>
                            <TableCell><Badge variant="default">{app.topFormat}</Badge></TableCell>
                            <TableCell><Badge variant="outline">{app.topProvider}</Badge></TableCell>
                            <TableCell><Badge variant="warning">{app.revenueStatus}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* TAB 3: NETWORKS */}
              {revenueTab === 'networks' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Ad Network Mediation & Fill Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Network Provider</TableHead>
                          <TableHead>Health</TableHead>
                          <TableHead className="text-right">Requests</TableHead>
                          <TableHead className="text-right">Impressions</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Fill Rate</TableHead>
                          <TableHead className="text-right">Failure Rate</TableHead>
                          <TableHead>Reporting Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {networksData.map((net) => (
                          <TableRow key={net.provider}>
                            <TableCell className="font-semibold">{net.name}</TableCell>
                            <TableCell>
                              <Badge variant={net.status.status === 'healthy' ? 'success' : 'warning'}>
                                {net.status.status} ({net.status.latencyMs}ms)
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{net.requests.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{net.impressions.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{net.clicks.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-600">{net.ctr}%</TableCell>
                            <TableCell className="text-right font-bold text-purple-600">{net.fillRate}%</TableCell>
                            <TableCell className="text-right text-rose-600">{net.failureRate}%</TableCell>
                            <TableCell>
                              <Badge variant={net.provider === 'custom_ads' ? 'default' : 'warning'}>
                                {net.revenueStatus}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* TAB 4: FORMATS */}
              {revenueTab === 'formats' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {formatsData.map((fmt) => (
                    <Card key={fmt.format}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wide flex justify-between items-center">
                          <span>{fmt.format.replace('_', ' ')}</span>
                          <Badge variant="outline">{fmt.ctr}% CTR</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b">
                          <span className="text-gray-500">Impressions</span>
                          <span className="font-bold">{fmt.impressions.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b">
                          <span className="text-gray-500">Clicks</span>
                          <span className="font-bold">{fmt.clicks.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b">
                          <span className="text-gray-500">Fill Rate</span>
                          <span className="font-bold text-purple-600">{fmt.fillRate}%</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-500">Revenue Status</span>
                          <Badge variant="warning">{fmt.revenueStatus}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* TAB 5: PLACEMENTS */}
              {revenueTab === 'placements' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Ad Unit & Placement Key Analytics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Placement Key</TableHead>
                          <TableHead>App</TableHead>
                          <TableHead>Format</TableHead>
                          <TableHead className="text-right">Impressions</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Fill Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {placementsData.map((plac) => (
                          <TableRow key={plac.placementId}>
                            <TableCell className="font-mono font-medium">{plac.placementId}</TableCell>
                            <TableCell><Badge variant="outline">{plac.appId}</Badge></TableCell>
                            <TableCell><Badge variant="default">{plac.format}</Badge></TableCell>
                            <TableCell className="text-right font-mono">{plac.impressions.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{plac.clicks.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-600">{plac.ctr}%</TableCell>
                            <TableCell className="text-right font-bold text-purple-600">{plac.fillRate}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* TAB 6: REVENUE & eCPM */}
              {revenueTab === 'revenue' && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-amber-600" />
                        Monetization & Provider Integration Checklist
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-gray-50 border rounded-lg space-y-3">
                        <div className="font-semibold text-sm text-gray-900">
                          Accounting Policy & Financial Reporting Guarantee
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          To maintain regulatory accuracy and prevent fabricated metrics, WAPCentral displays actual financial revenue only when server-to-server reporting APIs are verified and synchronized. No simulated revenue or fabricated eCPM is shown.
                        </p>
                      </div>

                      <div className="space-y-3">
                        {[
                          {
                            network: 'Google AdMob',
                            key: 'admob',
                            task: 'Link AdMob Publisher Account with AdMob Reporting API credentials via Secret Manager (ADMOB_REPORTING_CREDENTIALS)',
                            status: 'Awaiting Provider API Key',
                          },
                          {
                            network: 'Meta Audience Network',
                            key: 'meta',
                            task: 'Add Meta Graph API System User Token with read_audience_network_insights permission',
                            status: 'Awaiting Provider Token',
                          },
                          {
                            network: 'AppLovin MAX',
                            key: 'applovin',
                            task: 'Store AppLovin MAX Report Key in Secret Manager (APPLOVIN_REPORT_KEY)',
                            status: 'Awaiting Report Key',
                          },
                          {
                            network: 'WebAppyPie Custom Ads',
                            key: 'custom_ads',
                            task: 'Internal self-promotional cross-app advertising engine',
                            status: 'Active ($0 Spend)',
                          },
                        ].map((item) => (
                          <div key={item.key} className="flex justify-between items-center p-3 border rounded-lg text-xs">
                            <div>
                              <div className="font-bold text-gray-900">{item.network}</div>
                              <div className="text-gray-500 text-[11px] mt-0.5">{item.task}</div>
                            </div>
                            <Badge variant={item.key === 'custom_ads' ? 'success' : 'warning'}>
                              {item.status}
                            </Badge>
                          </div>
                        ))}
                      </div>

                      {costIntel && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                          <div className="font-semibold">Infrastructure Cost Intelligence</div>
                          <div className="text-[11px] text-blue-700 mt-1">
                            Status: <Badge variant="outline">{costIntel.infraCostStatus}</Badge>
                            <p className="mt-1">{costIntel.notes}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* TAB 7: CUSTOM ADS */}
              {revenueTab === 'custom_ads' && customAdsData && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500 font-medium">Cross-App Impressions</div>
                        <div className="text-2xl font-bold mt-1">{customAdsData.totalImpressions.toLocaleString()}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500 font-medium">Cross-App Clicks</div>
                        <div className="text-2xl font-bold mt-1 text-indigo-600">{customAdsData.totalClicks.toLocaleString()}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500 font-medium">Average Promotion CTR</div>
                        <div className="text-2xl font-bold mt-1 text-emerald-600">{customAdsData.ctr}%</div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold">Active Internal Campaigns</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Campaign</TableHead>
                            <TableHead className="text-right">Impressions</TableHead>
                            <TableHead className="text-right">Clicks</TableHead>
                            <TableHead className="text-right">CTR</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customAdsData.topCampaigns.map((c) => (
                            <TableRow key={c.campaignId}>
                              <TableCell className="font-medium">{c.title}</TableCell>
                              <TableCell className="text-right font-mono">{c.impressions.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-mono">{c.clicks.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-bold text-emerald-600">{c.ctr}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* TAB 8: NOTIFICATIONS */}
              {revenueTab === 'notifications' && notificationsData && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500 font-medium">Sent</div>
                        <div className="text-xl font-bold mt-1">{notificationsData.totalSent.toLocaleString()}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500 font-medium">Delivered</div>
                        <div className="text-xl font-bold mt-1 text-blue-600">{notificationsData.totalDelivered.toLocaleString()}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500 font-medium">Opened</div>
                        <div className="text-xl font-bold mt-1 text-emerald-600">{notificationsData.totalOpened.toLocaleString()}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500 font-medium">Open Rate</div>
                        <div className="text-xl font-bold mt-1 text-purple-600">{notificationsData.openRate}%</div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold">Category Volume Distribution</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs">
                        {Object.entries(notificationsData.categoryBreakdown).map(([cat, count]) => (
                          <div key={cat} className="flex justify-between p-2 bg-gray-50 rounded">
                            <span className="font-medium text-gray-800">{cat}</span>
                            <span className="font-bold">{count.toLocaleString()}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold">App Volume Distribution</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs">
                        {Object.entries(notificationsData.appBreakdown).map(([app, count]) => (
                          <div key={app} className="flex justify-between p-2 bg-gray-50 rounded">
                            <span className="font-medium text-gray-800">{app}</span>
                            <span className="font-bold">{count.toLocaleString()}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* TAB 9: EXPORT & RAW TELEMETRY */}
              {revenueTab === 'export' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Data Export & Retention Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 border rounded-lg bg-gray-50 space-y-3 text-xs">
                      <div className="font-bold text-gray-900">Export Analytics Data</div>
                      <p className="text-gray-600">
                        Export daily aggregated records including impressions, clicks, CTR, fill rate, failure counts, and provider status for external reporting or auditing.
                      </p>
                      <div className="flex gap-3 pt-2">
                        <Button onClick={handleExportCsv} variant="primary" size="sm">
                          <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                          Download CSV ({preset.toUpperCase()})
                        </Button>
                        <Button onClick={handleExportJson} variant="outline" size="sm">
                          <FileJson className="w-4 h-4 mr-1.5" />
                          Download JSON ({preset.toUpperCase()})
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg space-y-2 text-xs">
                      <div className="font-bold text-gray-900">Data Retention Standards</div>
                      <div className="text-gray-600 leading-relaxed">
                        • Raw ad telemetry events (impressions, clicks, requests): 90 days retention (automatic pruning)<br />
                        • Daily aggregates (analyticsDailyAggregates): 730 days (2 years) historical retention<br />
                        • Privacy safeguard: Zero personal data collected; hashed device IDs only
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* SECTION 2: AI & PLATFORM INTELLIGENCE (LEGACY PRESERVED) */}
      {sectionMode === 'ai_platform' && (
        <div className="space-y-6">
          <div className="flex border-b border-gray-200">
            {[
              { id: 'ai', label: 'AI Usage & Tokens' },
              { id: 'promotions', label: 'Self-Promotion CTR' },
              { id: 'alerts', label: 'Cost Alerts' },
              { id: 'retention', label: 'Data Retention' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAiTab(tab.id as AiTab)}
                className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                  aiTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* AI Usage */}
          {aiTab === 'ai' && usageSummary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-gray-500">Total AI Calls</div>
                    <div className="text-2xl font-bold mt-1">{usageSummary.totalRequests.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-gray-500">Tokens Processed</div>
                    <div className="text-2xl font-bold mt-1">{(usageSummary.totalInputTokens + usageSummary.totalOutputTokens).toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-gray-500">Estimated AI Cost</div>
                    <div className="text-2xl font-bold mt-1 text-emerald-600">${usageSummary.totalCostEstimateUsd.toFixed(4)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-gray-500">Avg Latency</div>
                    <div className="text-2xl font-bold mt-1">{usageSummary.avgLatencyMs}ms</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Self-Promotion */}
          {aiTab === 'promotions' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Promotion Campaign Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Impressions</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignStats.map((c) => (
                      <TableRow key={c.campaignId}>
                        <TableCell className="font-medium">{c.campaignName}</TableCell>
                        <TableCell className="text-right">{c.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{c.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">{c.ctr}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Cost Alerts */}
          {aiTab === 'alerts' && (
            <Card>
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-sm font-semibold">Cost Alert Thresholds</CardTitle>
                <Button size="sm" onClick={() => setIsAlertModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Rule
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Metric</TableHead>
                      <TableHead className="text-right">Threshold</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alertRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell><Badge variant="outline">{rule.metric}</Badge></TableCell>
                        <TableCell className="text-right font-mono">${rule.threshold.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={rule.enabled ? 'success' : 'default'}>
                            {rule.enabled ? 'Active' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleCostAlertRule(rule.id, !rule.enabled, actor)}
                            >
                              {rule.enabled ? 'Disable' : 'Enable'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteCostAlertRule(rule.id, actor)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Retention */}
          {aiTab === 'retention' && retentionPolicy && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Data Retention Policy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 mb-1">AI Usage Events TTL (Days)</label>
                    <input
                      type="number"
                      className="border rounded p-2 w-full"
                      value={editUsageTtl}
                      onChange={(e) => setEditUsageTtl(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Promotion Events TTL (Days)</label>
                    <input
                      type="number"
                      className="border rounded p-2 w-full"
                      value={editPromoTtl}
                      onChange={(e) => setEditPromoTtl(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      await updateDataRetentionPolicy(
                        { usageEventsTtlDays: editUsageTtl, promotionEventsTtlDays: editPromoTtl, auditLogsTtlDays: 365 },
                        actor,
                      );
                      setSaveRetentionSuccess(true);
                      setTimeout(() => setSaveRetentionSuccess(false), 2000);
                    }}
                  >
                    Save Retention Policy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPruning}
                    onClick={async () => {
                      setIsPruning(true);
                      const res = await triggerManualRetentionPruning(actor);
                      setPruneResult(res);
                      setIsPruning(false);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Prune Expired Data
                  </Button>
                </div>
                {saveRetentionSuccess && <span className="text-emerald-600">Saved!</span>}
                {pruneResult && (
                  <div className="text-gray-500">Pruned {pruneResult.prunedCount} expired records.</div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Alert Rule Creation Modal */}
      {isAlertModalOpen && (
        <Modal
          isOpen={isAlertModalOpen}
          onClose={() => setIsAlertModalOpen(false)}
          title="Create Cost Alert Rule"
        >
          <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium mb-1">Rule Name</label>
              <input
                className="w-full border rounded p-2"
                placeholder="e.g., Daily Gemini Cost Exceeded"
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Threshold ($)</label>
              <input
                type="number"
                step="0.5"
                className="w-full border rounded p-2"
                value={newRuleThreshold}
                onChange={(e) => setNewRuleThreshold(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Notification Emails</label>
              <input
                className="w-full border rounded p-2"
                value={newRuleEmails}
                onChange={(e) => setNewRuleEmails(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setIsAlertModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Alert</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
