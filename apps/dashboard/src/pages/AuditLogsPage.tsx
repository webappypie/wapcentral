import React, { useState, useEffect } from 'react';
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
import { FileText, ShieldAlert, Search } from 'lucide-react';
import { RoleGuard } from '../components/RoleGuard.js';
import type { AuditLog } from '@wapcentral/types';
import { subscribeAuditLogs } from '../services/auditService.js';

type ViewState = 'content' | 'loading' | 'empty' | 'error';

export const AuditLogsPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeAuditLogs(
      (loadedLogs) => setLogs(loadedLogs),
      () => {},
    );
    return () => unsubscribe();
  }, []);

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('delete') || action.includes('archive') || action.includes('pause')) {
      return 'warning';
    }
    if (action.includes('create') || action.includes('publish')) {
      return 'success';
    }
    return 'outline';
  };

  const filteredLogs = logs.filter(
    (log) =>
      log.actorEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceId.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
          <>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by actor, action, resource..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

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
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                          No audit log entries found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-slate-500 font-mono whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                            {log.actorEmail}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getActionBadgeVariant(log.action)}
                              className="font-mono text-[10px]"
                            >
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                            <span className="text-slate-400">{log.resourceType}/</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {log.resourceId}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-400">
                            {log.ipAddress || '127.0.0.1'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </RoleGuard>
  );
};
