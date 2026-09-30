import React, { useState, useEffect } from 'react';
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
import { Settings, Users, Shield, UserPlus, KeyRound, ShieldAlert, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import {
  fetchSecretStatusList,
  rotateSecret,
  type SecretItem,
} from '../services/secretsService.js';
import { SecretModal } from '../components/modals/SecretModal.js';

type ViewState = 'content' | 'loading' | 'empty' | 'error';
type Tab = 'team' | 'secrets';

export const SettingsPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');
  const [activeTab, setActiveTab] = useState<Tab>('team');
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [selectedSecret, setSelectedSecret] = useState<SecretItem | null>(null);
  const [isSecretModalOpen, setIsSecretModalOpen] = useState(false);
  const { hasRole, user } = useAuth();

  useEffect(() => {
    loadSecrets();
  }, []);

  const loadSecrets = async () => {
    const list = await fetchSecretStatusList();
    setSecrets(list);
  };

  const handleOpenRotate = (secret: SecretItem) => {
    setSelectedSecret(secret);
    setIsSecretModalOpen(true);
  };

  const handleRotateSubmit = async (name: string, value: string) => {
    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };
    await rotateSecret(name, value, actor);
    await loadSecrets();
  };

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
        title="Settings & Key Vault"
        description="Manage administrative users, role-based access control, and Secret Manager credentials"
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
            {activeTab === 'team' && hasRole('super_admin') && (
              <Button size="sm">
                <UserPlus className="mr-1.5 h-4 w-4" /> Invite Member
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'team'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Team & RBAC</span>
        </button>

        <button
          onClick={() => setActiveTab('secrets')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'secrets'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-amber-500" />
          <span>Secret Vault (Write-Only)</span>
        </button>
      </div>

      {viewState === 'loading' && (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {viewState === 'empty' && (
        <EmptyState
          title="No team members found"
          description="Invite your first administrator to collaborate on WebAppyPie Central."
          icon={<Settings className="h-6 w-6" />}
          actionLabel="Invite Member"
        />
      )}

      {viewState === 'error' && (
        <ErrorState
          title="Failed to load settings"
          message="Could not load system configuration."
          onRetry={() => setViewState('content')}
        />
      )}

      {viewState === 'content' && activeTab === 'team' && (
        <div className="space-y-6">
          {/* RBAC Levels Overview Card */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <CardTitle className="text-sm font-semibold">
                  Role Hierarchy & Permissions
                </CardTitle>
                <p className="text-xs text-slate-500">
                  WAPCentral enforces a 4-tier strict role hierarchy: Viewer &lt; Editor &lt; Admin
                  &lt; Super Admin.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <Badge variant="secondary" className="uppercase text-[10px] mb-2">
                    Viewer (L1)
                  </Badge>
                  <p className="text-[11px] text-slate-500">
                    Read-only access to apps, campaigns, analytics, and metrics.
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
                    Manage AI providers, rotate secrets (write-only), delete resources.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <Badge variant="destructive" className="uppercase text-[10px] mb-2">
                    Super Admin (L4)
                  </Badge>
                  <p className="text-[11px] text-slate-500">
                    Manage user roles, purge secrets, system control, audit review.
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

      {viewState === 'content' && activeTab === 'secrets' && (
        <div className="space-y-6">
          {/* Golden Rule Banner */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100">
                  Golden Rule: Private Credentials are Backend-Only
                </h4>
                <p className="mt-1 leading-relaxed text-slate-700 dark:text-slate-300">
                  All sensitive provider API keys and HMAC signing secrets reside strictly in{' '}
                  <strong>Google Cloud Secret Manager</strong>. Forms are strictly write-only:
                  secrets are never read back, decrypted, or displayed to dashboard users after
                  saving.
                </p>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Managed Secret Vault Keys</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Controlled by Secret Manager &middot; Rotations are logged to immutable audit
                  trail
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={loadSecrets} title="Refresh status">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Credential Key Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Last Rotated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {secrets.map((sec) => (
                    <TableRow key={sec.name}>
                      <TableCell>
                        <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                          {sec.name}
                        </div>
                        <div className="text-[11px] text-slate-500">{sec.description}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase text-[9px]">
                          {sec.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={sec.configured ? 'success' : 'secondary'}
                          className="text-[10px]"
                        >
                          {sec.configured ? 'Configured' : 'Not Set'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                        {sec.version ? `v${sec.version}` : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {sec.lastUpdated ? new Date(sec.lastUpdated).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        {hasRole('admin') && (
                          <Button variant="outline" size="sm" onClick={() => handleOpenRotate(sec)}>
                            <KeyRound className="w-3 h-3 mr-1 text-amber-500" />
                            {sec.configured ? 'Rotate' : 'Configure'}
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

      {/* Secret Rotation Modal */}
      <SecretModal
        isOpen={isSecretModalOpen}
        onClose={() => setIsSecretModalOpen(false)}
        secret={selectedSecret}
        onSubmit={handleRotateSubmit}
      />
    </div>
  );
};
