import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PageHeader,
  Spinner,
  ErrorState,
  Badge,
  Button,
} from '@wapcentral/ui';
import {
  type LucideIcon,
  LayoutDashboard,
  Layers,
  Smartphone,
  TrendingUp,
  Power,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { RoleGuard } from '../components/RoleGuard.js';
import type {
  AdNetwork,
  AdAppConfig,
  AdKillSwitches,
  CustomAdCampaign,
  App,
} from '@wapcentral/types';
import {
  subscribeAdNetworks,
  subscribeAdApps,
  subscribeCustomAdCampaigns,
  subscribeAdKillSwitches,
} from '../services/adsService.js';
import { subscribeApps } from '../services/appsService.js';

import { AdsOverviewTab } from '../components/ads/AdsOverviewTab.js';
import { AdNetworksTab } from '../components/ads/AdNetworksTab.js';
import { CustomAdsTab } from '../components/ads/CustomAdsTab.js';
import { AdKillSwitchesTab } from '../components/ads/AdKillSwitchesTab.js';

type TabId =
  | 'overview'
  | 'networks'
  | 'custom_ads'
  | 'kill_switches';

interface TabItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  highlight?: boolean;
}

export const AdsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Firestore State
  const [networks, setNetworks] = useState<AdNetwork[]>([]);
  const [apps, setApps] = useState<AdAppConfig[]>([]);
  const [registeredApps, setRegisteredApps] = useState<App[]>([]);
  const [campaigns, setCampaigns] = useState<CustomAdCampaign[]>([]);
  const [killSwitches, setKillSwitches] = useState<AdKillSwitches>({
    id: 'current',
    globalAdsDisabled: false,
    networks: {},
    apps: {},
    formats: {
      banner: false,
      native: false,
      interstitial: false,
      rewarded: false,
      app_open: false,
      rewarded_interstitial: false,
    },
    placements: {},
    customAdsDisabled: false,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  });

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const unsubs: Array<() => void> = [];

    try {
      unsubs.push(
        subscribeApps(
          (data) => setRegisteredApps(data),
          (err) => console.warn('Could not subscribe apps:', err),
        ),
      );
      unsubs.push(
        subscribeAdNetworks(
          (data) => setNetworks(data),
          (err) => setError(err.message),
        ),
      );
      unsubs.push(
        subscribeAdApps(
          (data) => setApps(data),
          (err) => setError(err.message),
        ),
      );
      unsubs.push(
        subscribeCustomAdCampaigns(
          (data) => setCampaigns(data),
          (err) => setError(err.message),
        ),
      );
      unsubs.push(
        subscribeAdKillSwitches(
          (data) => {
            setKillSwitches(data);
            setIsLoading(false);
          },
          (err) => {
            setError(err.message);
            setIsLoading(false);
          },
        ),
      );
    } catch (err: any) {
      setError(err.message || 'Failed to initialize ads subscriptions');
      setIsLoading(false);
    }

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, []);

  const isGlobalKilled = Boolean(killSwitches.globalAdsDisabled);

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'networks', label: 'Ad Networks', icon: Layers, badge: networks.length },
    { id: 'custom_ads', label: 'House Ads', icon: TrendingUp, badge: campaigns.length },
    {
      id: 'kill_switches',
      label: 'Emergency Kill Switches',
      icon: Power,
      highlight: isGlobalKilled,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center space-y-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading Ads & Monetization Control Center...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState
          title="Failed to Load Ads Control Center"
          message={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <RoleGuard requiredRole="viewer">
      <div className="space-y-6">
        {/* App-Centric Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-600 p-2 text-white">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                App-Centric Monetization Workflow
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                To configure simple ON/OFF formats, networks, Testing/Production mode, or production IDs for an app, select it in the Applications registry.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/apps')}
            className="flex items-center gap-1.5 shrink-0"
          >
            Go to Applications <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Page Header */}
        <PageHeader
          title="Ads & Monetization Control Center"
          description="Manage global network integrations, first-party house cross-promotions, and platform emergency kill switches."
          actions={
            <div className="flex items-center gap-2">
              {isGlobalKilled ? (
                <Badge variant="outline" className="border-red-400 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 font-mono text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  GLOBAL ADS OFF
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-mono text-xs">
                  PLATFORM ADS ACTIVE
                </Badge>
              )}
            </div>
          }
        />

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 dark:border-slate-800">
          <nav className="-mb-px flex space-x-6 overflow-x-auto pb-1" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 border-b-2 py-3 px-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                        isActive
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                  {tab.highlight && (
                    <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab View Rendering */}
        <div className="pt-2">
          {activeTab === 'overview' && (
            <AdsOverviewTab
              networks={networks}
              apps={apps}
              killSwitches={killSwitches}
              onNavigateTab={(tab) => {
                if (tab === 'kill_switches' || tab === 'custom_ads' || tab === 'networks') {
                  setActiveTab(tab as TabId);
                } else {
                  navigate('/apps');
                }
              }}
            />
          )}

          {activeTab === 'networks' && <AdNetworksTab networks={networks} />}

          {activeTab === 'custom_ads' && (
            <CustomAdsTab campaigns={campaigns} apps={registeredApps} />
          )}

          {activeTab === 'kill_switches' && (
            <AdKillSwitchesTab
              killSwitches={killSwitches}
              networks={networks}
              apps={apps}
            />
          )}
        </div>
      </div>
    </RoleGuard>
  );
};

export default AdsPage;
