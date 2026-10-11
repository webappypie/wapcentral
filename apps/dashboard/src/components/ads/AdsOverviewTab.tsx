import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Spinner,
} from '@wapcentral/ui';
import {
  Smartphone,
  Layers,
  Activity,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Power,
  Sliders,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type {
  AdNetwork,
  AdAppConfig,
  AdKillSwitches,
  AdsOverviewMetrics,
} from '@wapcentral/types';
import { fetchAdsOverview } from '../../services/adsService.js';

interface AdsOverviewTabProps {
  networks: AdNetwork[];
  apps: AdAppConfig[];
  killSwitches: AdKillSwitches;
  onNavigateTab: (tab: string) => void;
}

export const AdsOverviewTab: React.FC<AdsOverviewTabProps> = ({
  networks,
  apps,
  killSwitches,
  onNavigateTab,
}) => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<AdsOverviewMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchAdsOverview()
      .then((data) => {
        if (isMounted) {
          setMetrics(data);
          setLoadingMetrics(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load ad metrics:', err);
        if (isMounted) setLoadingMetrics(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const isGlobalKilled = Boolean(killSwitches.globalAdsDisabled);
  const activeNetworksCount = networks.filter((n) => n.enabled && !killSwitches.networks[n.id]).length;
  const activeAppsCount = apps.filter((a) => a.masterEnabled && !killSwitches.apps[a.appId]).length;

  return (
    <div className="space-y-6">
      {/* Emergency Global Kill Notice */}
      {isGlobalKilled && (
        <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4 text-red-900 dark:border-red-600 dark:bg-red-950/50 dark:text-red-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Power className="h-6 w-6 text-red-600 dark:text-red-400" />
              <div>
                <h3 className="font-bold text-sm">GLOBAL ADS KILL SWITCH IS ENGAGED</h3>
                <p className="text-xs text-red-700 dark:text-red-300">
                  All ad requests across FileZen, OptiLens, and all games are returning zero ads immediately.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab('kill_switches')}
              className="border-red-400 text-red-700 hover:bg-red-100 dark:text-red-200"
            >
              Manage Kill Switches
            </Button>
          </div>
        </div>
      )}

      {/* AppLovin MAX Sole Mediation Architecture Banner */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-slate-50 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-slate-900/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-600 text-white shadow-sm">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Sole Mediation Platform: AppLovin MAX
                </h3>
                <Badge variant="outline" className="border-indigo-300 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                  Lightweight Ads Architecture
                </Badge>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Unified demand competition across AppLovin, AdMob, Meta, InMobi, and Unity Ads without redundant SDKs or duplicate mediation engines.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/apps')}
              className="text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:border-indigo-800 flex items-center gap-1.5"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Configure Per-App Ads</span>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Monitored Apps</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{apps.length}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  <span className="font-semibold text-emerald-600">{activeAppsCount} active</span> ({apps.length - activeAppsCount} paused)
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <Smartphone className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Ad Networks</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                  {activeNetworksCount} / {networks.length}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {networks.filter((n) => n.environmentMode === 'production').length} in Production Mode
                </p>
              </div>
              <div className="rounded-xl bg-purple-50 p-2.5 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                <Layers className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Daily Impressions</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                  {loadingMetrics ? '...' : (metrics?.isRevenueConnected && metrics?.estimatedImpressionsDaily != null ? metrics.estimatedImpressionsDaily.toLocaleString() : 'Not configured')}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Fill Rate: <span className="font-semibold text-slate-600 dark:text-slate-300">{metrics?.isRevenueConnected && metrics?.fillRatePct != null ? `${metrics.fillRatePct.toFixed(1)}%` : 'Not available'}</span>
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <Activity className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Reported Revenue</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                  {loadingMetrics ? '...' : (metrics?.isRevenueConnected && metrics?.estimatedRevenueDailyUsd != null ? `$${metrics.estimatedRevenueDailyUsd.toFixed(2)}` : 'Not connected')}
                </h3>
                <div className="mt-1 text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                  <span>
                    Avg eCPM: <span className="font-semibold text-slate-700 dark:text-slate-300">{metrics?.isRevenueConnected && metrics && metrics.estimatedRevenueDailyUsd > 0 ? `$${((metrics.estimatedRevenueDailyUsd / (metrics.estimatedImpressionsDaily || 1)) * 1000).toFixed(2)}` : 'Not available'}</span>
                  </span>
                  {!metrics?.isRevenueConnected && (
                    <Badge variant="warning" className="text-[10px] py-0 px-1 font-normal">
                      {metrics?.revenueStatus || 'Not connected'}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network Health & Status Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold">Ad Network Health & Routing Status</CardTitle>
            <p className="text-xs text-slate-500">
              Live status across primary mediation partners and custom house ads inventory.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigateTab('networks')}
            className="text-xs"
          >
            Manage Networks
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Network</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Health Status</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Supported Formats</TableHead>
                <TableHead>Secret Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {networks.map((net) => {
                const isKilled = Boolean(killSwitches.networks[net.id]);
                const isHealthy = net.healthStatus.status === 'healthy' && !isKilled && net.enabled;
                return (
                  <TableRow key={net.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{net.name}</span>
                        {isKilled && (
                          <Badge variant="outline" className="border-red-300 text-red-600 text-[10px]">
                            Killed
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-mono ${
                          net.environmentMode === 'production'
                            ? 'text-emerald-700 border-emerald-300'
                            : 'text-amber-700 border-amber-300'
                        }`}
                      >
                        {net.environmentMode}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">
                        Tier #{net.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {isHealthy ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="text-xs capitalize">
                          {isKilled ? 'Kill Switch Active' : !net.enabled ? 'Disabled' : net.healthStatus.status}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 font-mono">
                      {net.healthStatus.latencyMs ? `${net.healthStatus.latencyMs}ms` : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {net.supportedFormats.slice(0, 3).map((fmt) => (
                          <span
                            key={fmt}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {fmt}
                          </span>
                        ))}
                        {net.supportedFormats.length > 3 && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                            +{net.supportedFormats.length - 3}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-slate-500">
                      {net.secretReferenceName ? (
                        <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                          <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                          {net.secretReferenceName}
                        </span>
                      ) : (
                        <span className="text-slate-400">First-Party / None</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card
          className="cursor-pointer transition-shadow hover:shadow-md border-indigo-200 dark:border-indigo-900"
          onClick={() => navigate('/apps')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">App Monetization Settings</h4>
                <p className="text-xs text-slate-500">
                  Select an application from the registry to configure simple ON/OFF formats, networks & IDs.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => onNavigateTab('kill_switches')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-50 p-2 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                <Power className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Emergency Kill Switches</h4>
                <p className="text-xs text-slate-500">
                  Instantly shut off ads globally, per-network, per-format, or per-app without redeployment.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => onNavigateTab('custom_ads')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">In-House Custom Ads</h4>
                <p className="text-xs text-slate-500">
                  Cross-promote WebAppyPie apps and games with zero provider commission.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
