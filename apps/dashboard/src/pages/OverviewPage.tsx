import React, { useState } from 'react';
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Spinner,
  EmptyState,
  ErrorState,
} from '@wapcentral/ui';
import { Smartphone, Sparkles, Megaphone, Tag, RefreshCw } from 'lucide-react';

type ViewState = 'content' | 'loading' | 'empty' | 'error';

export const OverviewPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Overview"
        description="Unified health, traffic, active campaigns, and mobile fleet status"
        actions={
          <div className="flex items-center gap-2">
            {/* State Switcher for Reviewing all required states */}
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
            <Button size="sm" variant="outline" onClick={() => setViewState('loading')}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {viewState === 'loading' && (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-slate-500">Loading overview metrics...</p>
          </div>
        </div>
      )}

      {viewState === 'empty' && (
        <EmptyState
          title="No applications registered"
          description="Register your first mobile application to begin routing AI requests and delivering campaigns."
          actionLabel="Add Application"
          onAction={() => setViewState('content')}
        />
      )}

      {viewState === 'error' && (
        <ErrorState
          title="Failed to load metrics"
          message="Could not connect to the Firestore metrics database. Please verify your connection."
          onRetry={() => setViewState('content')}
        />
      )}

      {viewState === 'content' && (
        <>
          {/* Top KPI Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Registered Apps
                </CardTitle>
                <Smartphone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-slate-500 mt-1">Across Android & iOS fleets</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Active Campaigns
                </CardTitle>
                <Tag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">5</div>
                <p className="text-xs text-emerald-600 font-medium mt-1">
                  100% non-blocking delivery
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  AI Daily Tokens
                </CardTitle>
                <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2.4M</div>
                <p className="text-xs text-slate-500 mt-1">Across OpenAI & Gemini</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Ad Networks</CardTitle>
                <Megaphone className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">4</div>
                <p className="text-xs text-slate-500 mt-1">AdMob, Meta, AppLovin, WAPAds</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Status Section */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Core Systems Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Firebase Firestore
                  </span>
                  <Badge variant="success">Operational</Badge>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Promotion Delivery API
                  </span>
                  <Badge variant="success">Operational</Badge>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    AI Routing Gateway
                  </span>
                  <Badge variant="success">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Cloud Storage CDN
                  </span>
                  <Badge variant="success">Operational</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Architecture Guarantees</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <div className="rounded-lg bg-indigo-50/60 p-3 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-300">
                  <strong>Non-Blocking Mobile Startup:</strong> Apps always start from local cache
                  and never wait for backend servers on launch.
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                  <strong>Secret Isolation:</strong> Private provider keys reside strictly in Secret
                  Manager and are never stored in Firestore or exposed to browsers.
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
