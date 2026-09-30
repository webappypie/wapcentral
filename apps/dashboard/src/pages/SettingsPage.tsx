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
import { Settings, Users, Shield, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';

type ViewState = 'content' | 'loading' | 'empty' | 'error';

export const SettingsPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');
  const { hasRole, user } = useAuth();

  const teamMembers = [
    {
      id: 'usr_01',
      name: 'Lead Engineer',
      email: 'lead@webappypie.com',
      role: 'super_admin',
      mfa: true,
      lastLogin: 'Active now',
    },
    {
      id: 'usr_02',
      name: 'Backend Dev',
      email: 'backend@webappypie.com',
      role: 'admin',
      mfa: true,
      lastLogin: '2 hours ago',
    },
    {
      id: 'usr_03',
      name: 'Campaign Manager',
      email: 'growth@webappypie.com',
      role: 'editor',
      mfa: false,
      lastLogin: 'Yesterday',
    },
    {
      id: 'usr_04',
      name: 'QA Analyst',
      email: 'qa@webappypie.com',
      role: 'viewer',
      mfa: false,
      lastLogin: '3 days ago',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Team RBAC"
        description="Role-based access control, security policies, and team management"
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
            {hasRole('super_admin') && (
              <Button size="sm">
                <UserPlus className="mr-1.5 h-4 w-4" /> Invite Member
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
          title="No team members found"
          description="Invite team members to assign roles."
          icon={<Users className="h-6 w-6" />}
          actionLabel="Invite Member"
          onAction={() => setViewState('content')}
        />
      )}

      {viewState === 'error' && (
        <ErrorState
          title="Failed to load settings"
          message="Could not load team members or security settings."
          onRetry={() => setViewState('content')}
        />
      )}

      {viewState === 'content' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-600" /> RBAC Role Matrix (4 Levels)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <Badge variant="secondary" className="uppercase text-[10px] mb-2">
                    Viewer (L1)
                  </Badge>
                  <p className="text-[11px] text-slate-500">
                    Read-only dashboards, metrics, apps, and campaigns.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <Badge variant="default" className="uppercase text-[10px] mb-2">
                    Editor (L2)
                  </Badge>
                  <p className="text-[11px] text-slate-500">
                    Create & update campaigns, apps, and feature flags.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <Badge variant="warning" className="uppercase text-[10px] mb-2">
                    Admin (L3)
                  </Badge>
                  <p className="text-[11px] text-slate-500">
                    Manage AI providers, delete resources, view audit logs.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <Badge variant="destructive" className="uppercase text-[10px] mb-2">
                    Super Admin (L4)
                  </Badge>
                  <p className="text-[11px] text-slate-500">
                    Manage user roles, assign permissions, system control.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Members Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Active Team Members</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>MFA</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {m.name}
                        </div>
                        <div className="text-xs text-slate-500">{m.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            m.role === 'super_admin'
                              ? 'destructive'
                              : m.role === 'admin'
                                ? 'warning'
                                : m.role === 'editor'
                                  ? 'default'
                                  : 'secondary'
                          }
                          className="uppercase text-[10px]"
                        >
                          {m.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {m.mfa ? (
                          <span className="text-xs text-emerald-600 font-medium">Enabled</span>
                        ) : (
                          <span className="text-xs text-slate-400">Disabled</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{m.lastLogin}</TableCell>
                      <TableCell className="text-right">
                        {hasRole('super_admin') && (
                          <Button variant="outline" size="sm">
                            Edit Role
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
