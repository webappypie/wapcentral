import React, { useState } from 'react';
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
  ErrorState,
} from '@wapcentral/ui';
import { Server, Activity, Database, ShieldCheck, RefreshCw } from 'lucide-react';

type ViewState = 'content' | 'loading' | 'empty' | 'error';

export const InfrastructurePage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');

  const services = [
    {
      name: 'Firestore Database',
      region: 'us-central1',
      status: 'healthy' as const,
      latency: '24ms',
      type: 'Primary Datastore',
    },
    {
      name: 'Promotion Delivery API',
      region: 'us-central1 (Cloud Run)',
      status: 'healthy' as const,
      latency: '38ms',
      type: 'Fast Edge Service',
    },
    {
      name: 'AI Routing Gateway',
      region: 'us-central1 (Cloud Run)',
      status: 'healthy' as const,
      latency: '112ms',
      type: 'Core AI Proxy',
    },
    {
      name: 'Firebase Cloud Storage',
      region: 'us-central1',
      status: 'healthy' as const,
      latency: '19ms',
      type: 'Creative CDN',
    },
    {
      name: 'Secret Manager',
      region: 'us-central1',
      status: 'healthy' as const,
      latency: '15ms',
      type: 'Key Vault',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Infrastructure Health"
        description="Real-time latency, availability heartbeats, and service status across Cloud Run & Firebase"
        actions={
          <div className="flex items-center gap-2">
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
            <Button size="sm" variant="outline" onClick={() => setViewState('loading')}>
              <RefreshCw className="h-4 w-4" />
            </Button>
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
          title="No infrastructure heartbeats recorded"
          description="Services will publish health check heartbeats automatically."
          icon={<Server className="h-6 w-6" />}
          actionLabel="Check Status"
          onAction={() => setViewState('content')}
        />
      )}

      {viewState === 'error' && (
        <ErrorState
          title="Health check polling failed"
          message="Could not communicate with the health-worker monitoring cluster."
          onRetry={() => setViewState('content')}
        />
      )}

      {viewState === 'content' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((svc) => (
              <Card key={svc.name}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-sm font-semibold">{svc.name}</CardTitle>
                    <span className="text-xs text-slate-500">{svc.type}</span>
                  </div>
                  <StatusIndicator status={svc.status} />
                </CardHeader>
                <CardContent className="space-y-2 pt-2 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800 mt-2">
                  <div className="flex justify-between">
                    <span>Region:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {svc.region}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>P95 Latency:</span>
                    <span className="font-semibold text-emerald-600">{svc.latency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Uptime (30d):</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">99.98%</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
