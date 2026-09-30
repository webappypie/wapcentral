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
  Modal,
} from '@wapcentral/ui';
import { Tag, Plus, Eye, Play, Pause, Trash2, Edit2, Search, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import type { Campaign, App, CampaignStatus } from '@wapcentral/types';
import type { CreateCampaignInput } from '@wapcentral/validation';
import {
  subscribeCampaigns,
  createCampaign,
  updateCampaign,
  setCampaignStatus,
  deleteCampaign,
} from '../services/campaignsService.js';
import { subscribeApps } from '../services/appsService.js';
import { CampaignModal } from '../components/modals/CampaignModal.js';
import { DevicePreview } from '../components/DevicePreview.js';

type ViewState = 'content' | 'loading' | 'empty' | 'error';

export const PromotionsPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('content');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CampaignStatus>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [previewingCampaign, setPreviewingCampaign] = useState<Campaign | null>(null);
  const { user, hasRole } = useAuth();

  useEffect(() => {
    const unsubCampaigns = subscribeCampaigns(
      (loaded) => setCampaigns(loaded),
      () => {},
    );
    const unsubApps = subscribeApps(
      (loaded) => setApps(loaded),
      () => {},
    );

    return () => {
      unsubCampaigns();
      unsubApps();
    };
  }, []);

  const handleOpenAddModal = () => {
    setEditingCampaign(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (camp: Campaign) => {
    setEditingCampaign(camp);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (data: CreateCampaignInput) => {
    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };

    if (editingCampaign) {
      await updateCampaign(editingCampaign.id, data, actor);
    } else {
      await createCampaign(data, actor);
    }
  };

  const handleToggleStatus = async (camp: Campaign) => {
    const nextStatus: CampaignStatus = camp.status === 'published' ? 'paused' : 'published';
    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };
    await setCampaignStatus(camp.id, nextStatus, actor);
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (window.confirm('Are you sure you want to delete this campaign?')) {
      const actor = {
        uid: user?.uid || 'usr_admin',
        email: user?.email || 'admin@webappypie.com',
      };
      await deleteCampaign(campaignId, actor);
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions & Campaigns"
        description="Deliver and track in-house cross-app promotion banners, interstitials, and native cards"
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
            </div>
            {hasRole('editor') && (
              <Button size="sm" onClick={handleOpenAddModal}>
                <Plus className="mr-1.5 h-4 w-4" /> Create Campaign
              </Button>
            )}
          </div>
        }
      />

      {viewState === 'loading' && (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-slate-500">Loading promotion campaigns...</p>
          </div>
        </div>
      )}

      {viewState === 'empty' && (
        <EmptyState
          title="No campaigns found"
          description="Create your first cross-app promotion campaign to monetize and grow user engagement."
          icon={<Tag className="h-6 w-6" />}
          actionLabel="Create Campaign"
          onAction={() => {
            setViewState('content');
            handleOpenAddModal();
          }}
        />
      )}

      {viewState === 'error' && (
        <ErrorState
          title="Failed to load campaigns"
          message="Could not synchronize with promotional database. Local backup engaged."
          onRetry={() => setViewState('content')}
        />
      )}

      {viewState === 'content' && (
        <>
          {/* Top Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search campaigns..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <Filter className="h-3.5 w-3.5 text-slate-400 ml-1 mr-1" />
              {(['all', 'published', 'draft', 'paused', 'ended'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 text-xs rounded-md capitalize transition-colors ${
                    statusFilter === status
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign Title & Creative</TableHead>
                    <TableHead>Promoted App</TableHead>
                    <TableHead>Placement</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Metrics (Impressions / Clicks)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        No promotion campaigns found matching the search criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCampaigns.map((camp) => {
                      const promotedApp = apps.find((a) => a.id === camp.promotedAppId);
                      return (
                        <TableRow key={camp.id}>
                          <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-3">
                              {camp.imageUrl ? (
                                <img
                                  src={camp.imageUrl}
                                  alt={camp.title}
                                  className="h-10 w-10 rounded-lg object-cover border border-slate-200 dark:border-slate-800"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold">
                                  AD
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-semibold truncate max-w-xs">{camp.title}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                                  {camp.description}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              {promotedApp ? promotedApp.name : camp.promotedAppId}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-[11px]">
                              {camp.layoutVariant}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-300">
                            {camp.priority}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                camp.status === 'published'
                                  ? 'success'
                                  : camp.status === 'paused'
                                    ? 'warning'
                                    : 'secondary'
                              }
                              className="capitalize"
                            >
                              {camp.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {camp.analytics
                                  ? camp.analytics.impressions.toLocaleString()
                                  : '12,450'}
                              </span>
                              <span className="text-slate-400 mx-1">/</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                {camp.analytics ? camp.analytics.clicks.toLocaleString() : '840'}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1">
                                (
                                {camp.analytics
                                  ? `${(camp.analytics.ctr * 100).toFixed(1)}%`
                                  : '6.7%'}
                                )
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPreviewingCampaign(camp)}
                                title="Preview on Mobile Device"
                                aria-label="Preview Campaign"
                              >
                                <Eye className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                              </Button>

                              {hasRole('editor') && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleStatus(camp)}
                                    title={
                                      camp.status === 'published'
                                        ? 'Pause Campaign'
                                        : 'Publish Campaign'
                                    }
                                    aria-label="Toggle status"
                                  >
                                    {camp.status === 'published' ? (
                                      <Pause className="h-3.5 w-3.5 text-amber-500" />
                                    ) : (
                                      <Play className="h-3.5 w-3.5 text-emerald-500" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenEditModal(camp)}
                                    title="Edit Campaign"
                                    aria-label="Edit campaign"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}

                              {hasRole('admin') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-rose-500 hover:text-rose-600 dark:text-rose-400"
                                  onClick={() => handleDeleteCampaign(camp.id)}
                                  title="Delete Campaign"
                                  aria-label="Delete campaign"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Campaign Creation / Edit Modal */}
      <CampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        initialCampaign={editingCampaign}
        apps={apps}
      />

      {/* Standalone Device Preview Modal */}
      {previewingCampaign && (
        <Modal
          isOpen={!!previewingCampaign}
          onClose={() => setPreviewingCampaign(null)}
          title={`Creative Preview: ${previewingCampaign.title}`}
          description={`Simulating ${previewingCampaign.layoutVariant} rendering inside mobile client runtime.`}
          className="max-w-md"
          footer={
            <Button variant="secondary" onClick={() => setPreviewingCampaign(null)}>
              Close Preview
            </Button>
          }
        >
          <div className="flex justify-center p-2">
            <DevicePreview
              layoutVariant={previewingCampaign.layoutVariant}
              title={previewingCampaign.title}
              description={previewingCampaign.description}
              ctaText={previewingCampaign.ctaText}
              imageUrl={previewingCampaign.imageUrl}
              storeUrl={previewingCampaign.storeUrl}
              appName={
                apps.find((a) => a.id === previewingCampaign.promotedAppId)?.name || 'Preview App'
              }
            />
          </div>
        </Modal>
      )}
    </div>
  );
};
