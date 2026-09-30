import React, { useState } from 'react';
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
} from '@wapcentral/ui';
import { Megaphone, Layers, CheckCircle2 } from 'lucide-react';

type ViewState = 'content' | 'loading' | 'empty' | 'error';

export const AdsPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');

  const adNetworks = [
    {
      name: 'Google AdMob',
      type: 'External Ad Network',
      formats: ['Banner', 'Interstitial', 'Rewarded', 'Native'],
      status: 'Configured',
      description: 'Primary Google mobile ad inventory with adaptive banners and rewarded video',
    },
    {
      name: 'Meta Audience Network',
      type: 'External Ad Network',
      formats: ['Banner', 'Interstitial', 'Rewarded'],
      status: 'Configured',
      description: 'High-performing social demand and bidding inventory from Meta',
    },
    {
      name: 'AppLovin MAX',
      type: 'Mediation Platform',
      formats: ['Bidding Mediation', 'Waterfall', 'AdMob/Meta Adapter'],
      status: 'Active Mediation',
      description: 'Primary mediation platform dynamically orchestrating real-time ad auctions',
    },
    {
      name: 'WAPAds (Own Promotion)',
      type: 'First-Party Network',
      formats: ['Banner', 'Interstitial', 'Native House Ads'],
      status: 'Enabled (Zero Ad Spend)',
      description:
        'First-party cross-app promotion network delivering house ads when fill is low or user retention is prioritized',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ad Networks & Mediation"
        description="Configure Google AdMob, Meta Audience Network, AppLovin MAX, and first-party WAPAds"
        actions={
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
        }
      />

      {viewState === 'loading' && (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {viewState === 'empty' && (
        <EmptyState
          title="No ad networks configured"
          description="Configure AdMob, Meta, or AppLovin MAX ad units to begin monetizing mobile apps."
          icon={<Megaphone className="h-6 w-6" />}
          actionLabel="Configure Network"
          onAction={() => setViewState('content')}
        />
      )}

      {viewState === 'error' && (
        <ErrorState
          title="Failed to load ad network configurations"
          message="Could not load ad configurations."
          onRetry={() => setViewState('content')}
        />
      )}

      {viewState === 'content' && (
        <div className="grid gap-6 md:grid-cols-2">
          {adNetworks.map((net) => (
            <Card key={net.name} className="flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{net.name}</CardTitle>
                    <span className="text-xs text-slate-500">{net.type}</span>
                  </div>
                  <Badge variant="success" className="text-[10px]">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> {net.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {net.description}
                </p>
                <div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Supported Formats:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {net.formats.map((f) => (
                      <span
                        key={f}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
