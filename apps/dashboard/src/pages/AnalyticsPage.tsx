import React, { useState } from 'react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Spinner,
  EmptyState,
  ErrorState,
} from '@wapcentral/ui';
import { BarChart3, TrendingUp, DollarSign, Cpu } from 'lucide-react';

type ViewState = 'content' | 'loading' | 'empty' | 'error';

export const AnalyticsPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usage & Cost Analytics"
        description="Daily token consumption, estimated provider costs, and promotion delivery throughput"
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

      {viewState === 'content' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Estimated Monthly AI Spend</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$142.80</div>
                <p className="text-xs text-slate-500 mt-1">
                  Labeled as ESTIMATE (Cost transparency)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Tokens (30d)</CardTitle>
                <Cpu className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">48.2M</div>
                <p className="text-xs text-slate-500 mt-1">82% Gemini, 18% OpenAI</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Promo Conversions (30d)</CardTitle>
                <TrendingUp className="h-4 w-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">18,450</div>
                <p className="text-xs text-slate-500 mt-1">First-party installs generated</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
