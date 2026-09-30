import React, { useState } from 'react';
import {
  PageHeader,
  Card,
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
import { useAuth } from '../contexts/AuthContext.js';
import { RoleGuard } from '../components/RoleGuard.js';
import { Plus, Smartphone, Trash2, Edit2 } from 'lucide-react';

type ViewState = 'content' | 'loading' | 'empty' | 'error';

interface MockApp {
  id: string;
  name: string;
  packageId: string;
  platform: 'android' | 'ios';
  version: string;
  environment: string;
  modules: string[];
}

const mockApps: MockApp[] = [
  {
    id: 'app_01',
    name: 'WebAppyPie Reader',
    packageId: 'com.webappypie.reader',
    platform: 'android',
    version: '1.2.0',
    environment: 'production',
    modules: ['promotion', 'ai', 'ads'],
  },
  {
    id: 'app_02',
    name: 'Pie Calc Pro',
    packageId: 'com.webappypie.calc',
    platform: 'ios',
    version: '2.0.4',
    environment: 'production',
    modules: ['promotion', 'ads'],
  },
  {
    id: 'app_03',
    name: 'WAP Notes AI',
    packageId: 'com.webappypie.notes',
    platform: 'android',
    version: '1.0.1',
    environment: 'staging',
    modules: ['ai', 'promotion'],
  },
];

export const AppsPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');
  const [showRoleDeniedPreview, setShowRoleDeniedPreview] = useState(false);
  const { hasRole } = useAuth();

  if (showRoleDeniedPreview) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setShowRoleDeniedPreview(false)}>
          ← Exit Permission Preview
        </Button>
        <RoleGuard requiredRole="super_admin">
          <div>This content is restricted.</div>
        </RoleGuard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="App Registry"
        description="Register and configure WebAppyPie mobile applications and enabled modules"
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
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
              <button
                onClick={() => setShowRoleDeniedPreview(true)}
                className="rounded px-2 py-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              >
                403 State
              </button>
            </div>
            {hasRole('editor') && (
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" /> Add App
              </Button>
            )}
          </div>
        }
      />

      {viewState === 'loading' && (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-slate-500">Loading registered apps...</p>
          </div>
        </div>
      )}

      {viewState === 'empty' && (
        <EmptyState
          title="No apps in registry"
          description="Register your first Android or iOS app to enable promotion, ads, and AI features."
          icon={<Smartphone className="h-6 w-6" />}
          actionLabel="Register App"
          onAction={() => setViewState('content')}
        />
      )}

      {viewState === 'error' && (
        <ErrorState
          title="Failed to load app registry"
          message="Could not retrieve the registered apps list from Firestore."
          onRetry={() => setViewState('content')}
        />
      )}

      {viewState === 'content' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App Name & Package</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Modules</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockApps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {app.name}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">{app.packageId}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {app.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{app.version}</TableCell>
                    <TableCell>
                      <Badge
                        variant={app.environment === 'production' ? 'success' : 'secondary'}
                        className="capitalize text-[10px]"
                      >
                        {app.environment}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {app.modules.map((m) => (
                          <span
                            key={m}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300 uppercase font-medium"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {hasRole('editor') && (
                          <Button variant="ghost" size="icon" title="Edit App">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        {hasRole('admin') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:text-rose-600"
                            title="Delete App"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
