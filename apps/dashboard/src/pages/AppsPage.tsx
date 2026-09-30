import React, { useState, useEffect } from 'react';
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
import { Plus, Smartphone, Trash2, Edit2, Search } from 'lucide-react';
import type { App } from '@wapcentral/types';
import type { CreateAppInput } from '@wapcentral/validation';
import { subscribeApps, createApp, updateApp, deleteApp } from '../services/appsService.js';
import { AppModal } from '../components/modals/AppModal.js';

type ViewState = 'content' | 'loading' | 'empty' | 'error';

export const AppsPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');
  const [showRoleDeniedPreview, setShowRoleDeniedPreview] = useState(false);
  const [apps, setApps] = useState<App[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'android' | 'ios' | 'web'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const { user, hasRole } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribeApps(
      (loadedApps) => {
        setApps(loadedApps);
      },
      () => {
        // Handled gracefully with fallback in service
      },
    );

    return () => unsubscribe();
  }, []);

  const handleOpenAddModal = () => {
    setEditingApp(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (app: App) => {
    setEditingApp(app);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (data: CreateAppInput) => {
    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };

    if (editingApp) {
      await updateApp(editingApp.id, data, actor);
    } else {
      await createApp(data, actor);
    }
  };

  const handleDeleteApp = async (appId: string) => {
    if (window.confirm('Are you sure you want to archive this application?')) {
      const actor = {
        uid: user?.uid || 'usr_admin',
        email: user?.email || 'admin@webappypie.com',
      };
      await deleteApp(appId, actor);
    }
  };

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

  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.packageId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform = platformFilter === 'all' || app.platform === platformFilter;
    return matchesSearch && matchesPlatform;
  });

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
              <Button size="sm" onClick={handleOpenAddModal}>
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
          onAction={() => {
            setViewState('content');
            handleOpenAddModal();
          }}
        />
      )}

      {viewState === 'error' && (
        <ErrorState
          title="Failed to load app registry"
          message="There was an error communicating with the Firestore database. Local fallback was engaged."
          onRetry={() => setViewState('content')}
        />
      )}

      {viewState === 'content' && (
        <>
          {/* Filters and search bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by app name or package ID..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">Platform:</span>
              {(['all', 'android', 'ios', 'web'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className={`px-2.5 py-1 text-xs rounded-md capitalize transition-colors ${
                    platformFilter === p
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App Name</TableHead>
                    <TableHead>Package ID</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Enabled Modules</TableHead>
                    {hasRole('editor') && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        No applications matched your filter criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredApps.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs">
                              {app.name.charAt(0)}
                            </div>
                            <div>
                              <span>{app.name}</span>
                              {app.status === 'archived' && (
                                <Badge variant="secondary" className="ml-2 text-[10px]">
                                  Archived
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          {app.packageId}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              app.platform === 'android'
                                ? 'success'
                                : app.platform === 'ios'
                                  ? 'default'
                                  : 'secondary'
                            }
                            className="capitalize"
                          >
                            {app.platform}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-300">
                          v{app.version}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              app.environment === 'production'
                                ? 'default'
                                : app.environment === 'staging'
                                  ? 'warning'
                                  : 'secondary'
                            }
                            className="capitalize text-[11px]"
                          >
                            {app.environment}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {app.enabledModules.map((mod) => (
                              <Badge key={mod} variant="outline" className="text-[10px] capitalize">
                                {mod}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        {hasRole('editor') && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditModal(app)}
                                aria-label="Edit app"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              {hasRole('admin') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-rose-500 hover:text-rose-600 dark:text-rose-400"
                                  onClick={() => handleDeleteApp(app.id)}
                                  aria-label="Delete app"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* App Registration & Edit Modal */}
      <AppModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        initialApp={editingApp}
      />
    </div>
  );
};
