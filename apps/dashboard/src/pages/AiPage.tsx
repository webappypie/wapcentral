import React, { useState } from 'react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Spinner,
  EmptyState,
  ErrorState,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@wapcentral/ui';
import { Sparkles, Plus, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';

type ViewState = 'content' | 'loading' | 'empty' | 'error';

export const AiPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');
  const { hasRole } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Gateway"
        description="Unified model routing, provider failover, token quotas, and policy management"
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
            {hasRole('admin') && (
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" /> Add Provider
              </Button>
            )}
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
          title="No AI providers configured"
          description="Add OpenAI, Gemini, Anthropic, or self-hosted model endpoints to activate the gateway."
          icon={<Sparkles className="h-6 w-6" />}
          actionLabel="Add Provider"
          onAction={() => setViewState('content')}
        />
      )}

      {viewState === 'error' && (
        <ErrorState
          title="Failed to load AI configuration"
          message="Could not load AI providers or routing policies."
          onRetry={() => setViewState('content')}
        />
      )}

      {viewState === 'content' && (
        <div className="space-y-6">
          {/* Provider Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">OpenAI</CardTitle>
                <Badge variant="success">Active</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Models:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    gpt-4o, gpt-4o-mini
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="text-emerald-600 font-medium">Healthy (142ms)</span>
                </div>
                <div className="flex justify-between">
                  <span>Secret:</span>
                  <span className="font-mono text-slate-400">Secret Manager [LOCKED]</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Google Gemini</CardTitle>
                <Badge variant="success">Active</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Models:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    gemini-1.5-flash, pro
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="text-emerald-600 font-medium">Healthy (118ms)</span>
                </div>
                <div className="flex justify-between">
                  <span>Secret:</span>
                  <span className="font-mono text-slate-400">Secret Manager [LOCKED]</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Anthropic</CardTitle>
                <Badge variant="secondary">Standby</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Models:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    claude-3-5-sonnet
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="text-slate-400">Failover Tier 2</span>
                </div>
                <div className="flex justify-between">
                  <span>Secret:</span>
                  <span className="font-mono text-slate-400">Secret Manager [LOCKED]</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Routing Policies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-indigo-600" /> Routing Policies
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature / Intent</TableHead>
                    <TableHead>Primary Provider</TableHead>
                    <TableHead>Fallback Chain</TableHead>
                    <TableHead>Rate Limit</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-semibold">chat_assistant</TableCell>
                    <TableCell>Gemini (gemini-1.5-flash)</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">
                      OpenAI (gpt-4o-mini)
                    </TableCell>
                    <TableCell>60 req / min</TableCell>
                    <TableCell>
                      <Badge variant="success">Active</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">image_analysis</TableCell>
                    <TableCell>OpenAI (gpt-4o)</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">
                      Gemini (gemini-1.5-pro)
                    </TableCell>
                    <TableCell>30 req / min</TableCell>
                    <TableCell>
                      <Badge variant="success">Active</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
