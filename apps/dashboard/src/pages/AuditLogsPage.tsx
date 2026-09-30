import React, { useState } from 'react';
import {
  PageHeader,
  Card,
  CardContent,
  Spinner,
  EmptyState,
  ErrorState,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Badge,
} from '@wapcentral/ui';
import { FileText, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { RoleGuard } from '../components/RoleGuard.js';

type ViewState = 'content' | 'loading' | 'empty' | 'error';

export const AuditLogsPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');
  const { hasRole } = useAuth();

  const mockLogs = [
    {
      id: 'log_01',
      actor: 'admin@webappypie.com',
      action: 'campaign.publish',
      resource: 'campaign/camp_01',
      ip: '192.168.1.42',
      timestamp: '10 mins ago',
    },
    {
      id: 'log_02',
      actor: 'editor@webappypie.com',
      action: 'flag.update',
      resource: 'featureFlags/promotion_enabled',
      ip: '192.168.1.18',
      timestamp: '1 hour ago',
    },
    {
      id: 'log_03',
      actor: 'admin@webappypie.com',
      action: 'app.create',
      resource: 'apps/app_03',
      ip: '192.168.1.42',
      timestamp: '3 hours ago',
    },
  ];

  return (
    <RoleGuard requiredRole="admin">
      <div className="space-y-6">
        <PageHeader
          title="Audit Logs"
          description="Immutable, tamper-evident audit trail of administrative changes (Admin role required)"
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
            title="No audit events found"
            description="Administrative actions will appear in this immutable trail automatically."
            icon={<FileText className="h-6 w-6" />}
          />
        )}

        {viewState === 'error' && (
          <ErrorState
            title="Failed to load audit trail"
            message="Could not read audit logs from Firestore."
            onRetry={() => setViewState('content')}
          />
        )}

        {viewState === 'content' && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Origin IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-slate-500">{log.timestamp}</TableCell>
                      <TableCell className="font-semibold text-xs">{log.actor}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                        {log.resource}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-400">{log.ip}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </RoleGuard>
  );
};
