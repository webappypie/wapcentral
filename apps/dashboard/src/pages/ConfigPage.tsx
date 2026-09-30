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
import { Sliders, Plus, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';

type ViewState = 'content' | 'loading' | 'empty' | 'error';

export const ConfigPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');
  const { hasRole } = useAuth();

  const mockFlags = [
    {
      key: 'promotion_enabled',
      type: 'boolean',
      value: true,
      scope: 'Global',
      description: 'Master switch for self-promotion campaigns across all mobile apps',
      dualLayer: 'Mirrored in Remote Config',
    },
    {
      key: 'ai_enabled',
      type: 'boolean',
      value: true,
      scope: 'Global',
      description: 'Master switch for mobile AI generation and routing features',
      dualLayer: 'Mirrored in Remote Config',
    },
    {
      key: 'ads_enabled',
      type: 'boolean',
      value: true,
      scope: 'Global',
      description: 'Master switch for 3rd-party ad SDKs (AdMob, Meta, AppLovin)',
      dualLayer: 'Mirrored in Remote Config',
    },
    {
      key: 'maintenance_mode',
      type: 'boolean',
      value: false,
      scope: 'Global',
      description: 'Puts all mobile applications into maintenance banner mode',
      dualLayer: 'Mirrored in Remote Config',
    },
    {
      key: 'min_app_version',
      type: 'string',
      value: '1.0.0',
      scope: 'Global',
      description: 'Enforces minimum supported version prompt in mobile SDK',
      dualLayer: 'Mirrored in Remote Config',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Flags & Configuration"
        description="Dual-layer flag management: Firestore (primary source of truth) and Firebase Remote Config (mobile runtime delivery)"
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
            {hasRole('editor') && (
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" /> Add Flag
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
          title="No feature flags configured"
          description="Create your first feature flag to control mobile runtime behavior."
          icon={<Sliders className="h-6 w-6" />}
          actionLabel="Create Flag"
          onAction={() => setViewState('content')}
        />
      )}

      {viewState === 'error' && (
        <ErrorState
          title="Failed to load feature flags"
          message="Could not load flags from Firestore."
          onRetry={() => setViewState('content')}
        />
      )}

      {viewState === 'content' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Active Flags & Runtime Sync
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flag Key & Description</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Current Value</TableHead>
                  <TableHead>Dual-Layer Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockFlags.map((flag) => (
                  <TableRow key={flag.key}>
                    <TableCell>
                      <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                        {flag.key}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{flag.description}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {flag.scope}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{flag.type}</TableCell>
                    <TableCell>
                      {typeof flag.value === 'boolean' ? (
                        flag.value ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <Check className="h-3 w-3" /> Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                            <X className="h-3 w-3" /> Disabled
                          </span>
                        )
                      ) : (
                        <span className="font-mono text-xs font-semibold">
                          {String(flag.value)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                        {flag.dualLayer}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {hasRole('editor') && (
                        <Button variant="outline" size="sm">
                          Toggle
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
