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
import { Tag, Plus, Eye, MousePointerClick } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';

type ViewState = 'content' | 'loading' | 'empty' | 'error';

export const PromotionsPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');
  const { hasRole } = useAuth();

  const mockCampaigns = [
    {
      id: 'camp_01',
      title: 'Upgrade to Pie Calc Pro',
      targetApps: 'All Android Apps',
      priority: 90,
      layout: 'banner',
      status: 'active',
      impressions: '142,500',
      clicks: '8,420',
      ctr: '5.91%',
    },
    {
      id: 'camp_02',
      title: 'Try WAP Notes AI',
      targetApps: 'WebAppyPie Reader',
      priority: 75,
      layout: 'interstitial',
      status: 'active',
      impressions: '65,200',
      clicks: '3,890',
      ctr: '5.96%',
    },
    {
      id: 'camp_03',
      title: 'Reader V2 Early Access',
      targetApps: 'Pie Calc Pro',
      priority: 50,
      layout: 'native',
      status: 'paused',
      impressions: '21,000',
      clicks: '740',
      ctr: '3.52%',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Self-Promotion Campaigns"
        description="Deliver non-blocking cross-promotions across WebAppyPie mobile apps with zero ad spend"
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
                <Plus className="mr-1.5 h-4 w-4" /> Create Campaign
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
          title="No campaigns created"
          description="Create your first cross-app promotion campaign to promote your other applications."
          icon={<Tag className="h-6 w-6" />}
          actionLabel="Create Campaign"
          onAction={() => setViewState('content')}
        />
      )}

      {viewState === 'error' && (
        <ErrorState
          title="Failed to load campaigns"
          message="Could not load campaign list from database."
          onRetry={() => setViewState('content')}
        />
      )}

      {viewState === 'content' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign Title</TableHead>
                  <TableHead>Target Apps</TableHead>
                  <TableHead>Layout</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockCampaigns.map((camp) => (
                  <TableRow key={camp.id}>
                    <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                      {camp.title}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                      {camp.targetApps}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {camp.layout}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{camp.priority}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3 text-slate-400" /> {camp.impressions}
                        </span>
                        <span className="flex items-center gap-1">
                          <MousePointerClick className="h-3 w-3 text-slate-400" /> {camp.clicks}
                        </span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {camp.ctr}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={camp.status === 'active' ? 'success' : 'secondary'}
                        className="capitalize text-[10px]"
                      >
                        {camp.status}
                      </Badge>
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
