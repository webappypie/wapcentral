import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@wapcentral/ui';
import {
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  ExternalLink,
  Smartphone,
  Eye,
  Play,
  Pause,
  Upload,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Video,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
  FileCheck,
  Check,
  type LucideIcon,
} from 'lucide-react';
import type {
  CustomAdCampaign,
  App,
  AdFormat,
  CreativeType,
  CarouselItem,
  CustomAdCreative,
} from '@wapcentral/types';
import {
  createCustomAdCampaign,
  updateCustomAdCampaign,
  deleteCustomAdCampaign,
} from '../../services/adsService.js';
import {
  uploadCreativeAsset,
  validateCreativeFile,
  type UploadedAssetResult,
} from '../../services/storageService.js';
import { useAuth } from '../../contexts/AuthContext.js';

interface CustomAdsTabProps {
  campaigns: CustomAdCampaign[];
  apps: App[];
}

const ALL_AD_FORMATS: Array<{ id: AdFormat; label: string; fieldKey: string }> = [
  { id: 'banner', label: 'Banner', fieldKey: 'banner' },
  { id: 'native', label: 'Native Card', fieldKey: 'native' },
  { id: 'interstitial', label: 'Interstitial', fieldKey: 'interstitial' },
  { id: 'rewarded', label: 'Rewarded', fieldKey: 'rewarded' },
  { id: 'app_open', label: 'App Open', fieldKey: 'appOpen' },
  { id: 'rewarded_interstitial', label: 'Rewarded Interstitial', fieldKey: 'rewardedInterstitial' },
];

const CREATIVE_TYPES: Array<{
  id: CreativeType;
  label: string;
  formatHint: string;
  icon: LucideIcon;
  description: string;
}> = [
  { id: 'image', label: 'Image', formatHint: 'JPG, PNG, WebP', icon: ImageIcon, description: 'High-res display graphic' },
  { id: 'video', label: 'Video', formatHint: 'MP4, WebM', icon: Video, description: 'Muted autoplay video' },
  { id: 'animated', label: 'Animated', formatHint: 'GIF, Lottie', icon: Sparkles, description: 'UI animation or GIF' },
  { id: 'native_card', label: 'Native Card', formatHint: 'Card Layout', icon: Smartphone, description: 'In-feed rich card' },
  { id: 'carousel', label: 'Carousel', formatHint: 'Multi-Slide', icon: Layers, description: 'Swipable promo deck' },
];

function isValidDestination(val: string): boolean {
  if (!val || !val.trim()) return false;
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/.+/.test(val.trim());
}

export const CustomAdsTab: React.FC<CustomAdsTabProps> = ({
  campaigns,
  apps,
}) => {
  const { user, hasRole } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CustomAdCampaign | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formTargetApp, setFormTargetApp] = useState<string>('');
  const [formCreativeType, setFormCreativeType] = useState<CreativeType>('image');
  const [formPlacements, setFormPlacements] = useState<AdFormat[]>(['banner', 'native']);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCta, setFormCta] = useState('Install Free');
  const [formDestinationUrl, setFormDestinationUrl] = useState('');
  const [formPriority, setFormPriority] = useState<number>(1);
  const [formStatus, setFormStatus] = useState<'active' | 'paused' | 'draft'>('active');
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');

  // Primary Asset Metadata
  const [mediaAssetUrl, setMediaAssetUrl] = useState('');
  const [mediaThumbnailUrl, setMediaThumbnailUrl] = useState('');
  const [mediaStoragePath, setMediaStoragePath] = useState('');
  const [mediaMimeType, setMediaMimeType] = useState('');
  const [mediaFileSizeBytes, setMediaFileSizeBytes] = useState<number>(0);
  const [mediaWidth, setMediaWidth] = useState<number | undefined>(undefined);
  const [mediaHeight, setMediaHeight] = useState<number | undefined>(undefined);
  const [mediaDurationSeconds, setMediaDurationSeconds] = useState<number | undefined>(undefined);

  // Upload Progress & Errors
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Carousel Items State
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([
    {
      id: 'slide_1',
      imageUrl: '',
      title: 'Slide 1 Headline',
      description: 'Slide description copy',
      ctaText: 'Install Free',
      destinationUrl: '',
    },
  ]);
  const [activeCarouselSlide, setActiveCarouselSlide] = useState(0);

  // Live Preview Preview Mode (banner / native / interstitial)
  const [previewFormat, setPreviewFormat] = useState<'banner' | 'native' | 'interstitial'>('native');

  // File Input References
  const primaryFileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbnailFileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal ESC handler & body scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen]);

  // Resolve currently selected target app
  const selectedApp = apps.find((a) => a.id === formTargetApp);

  // Compute available placements based on app's simpleAdsConfig
  const availableFormatsForApp = React.useMemo(() => {
    if (!selectedApp) return ALL_AD_FORMATS;
    const enabledFormats = selectedApp.simpleAdsConfig?.enabledFormats;
    if (!enabledFormats) return ALL_AD_FORMATS;

    return ALL_AD_FORMATS.filter((fmt) => {
      const isEnabled = (enabledFormats as unknown as Record<string, boolean>)[fmt.fieldKey];
      return isEnabled !== false;
    });
  }, [selectedApp]);

  // Adjust placements when app changes
  const handleAppChange = (appId: string) => {
    setFormTargetApp(appId);
    const target = apps.find((a) => a.id === appId);
    if (target?.simpleAdsConfig?.enabledFormats) {
      const allowed = ALL_AD_FORMATS.filter((f) => (target.simpleAdsConfig?.enabledFormats as unknown as Record<string, boolean>)[f.fieldKey] !== false)
        .map((f) => f.id);
      if (allowed.length > 0) {
        setFormPlacements(allowed);
      }
    }
  };

  const openCreateModal = () => {
    const defaultAppId = apps.length > 0 ? apps[0]!.id : '';
    const today = new Date().toISOString().split('T')[0]!;
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]!;

    setEditingCampaign(null);
    setFormName('');
    setFormTargetApp(defaultAppId);
    setFormCreativeType('image');
    setFormPlacements(['banner', 'native']);
    setFormTitle('');
    setFormDesc('');
    setFormCta('Install Free');
    setFormDestinationUrl('https://webappypie.com/apps/');
    setFormPriority(1);
    setFormStatus('active');
    setFormStartDate(today);
    setFormEndDate(nextYear);

    setMediaAssetUrl('');
    setMediaThumbnailUrl('');
    setMediaStoragePath('');
    setMediaMimeType('');
    setMediaFileSizeBytes(0);
    setMediaWidth(undefined);
    setMediaHeight(undefined);
    setMediaDurationSeconds(undefined);

    setIsUploading(false);
    setUploadProgress(null);
    setUploadError(null);

    setCarouselItems([
      {
        id: `slide_${Date.now()}_1`,
        imageUrl: '',
        title: 'Feature Spotlight',
        description: 'Explore state-of-the-art tools crafted for peak mobile efficiency.',
        ctaText: 'Install Free',
        destinationUrl: 'https://webappypie.com/apps/',
      },
      {
        id: `slide_${Date.now()}_2`,
        imageUrl: '',
        title: 'Lightning Performance',
        description: 'Zero bloat, battery-friendly, and completely private.',
        ctaText: 'Try Now',
        destinationUrl: 'https://webappypie.com/apps/',
      },
    ]);
    setActiveCarouselSlide(0);
    setPreviewFormat('native');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (camp: CustomAdCampaign) => {
    setEditingCampaign(camp);
    setFormName(camp.title);
    setFormTargetApp(camp.targetAppId || camp.targetApps[0] || (apps.length > 0 ? apps[0]!.id : ''));
    setFormCreativeType(camp.creativeType || (camp.creatives?.[0]?.creativeType as CreativeType) || 'image');
    setFormPlacements(camp.placements && camp.placements.length > 0 ? camp.placements : ['banner', 'native']);
    setFormTitle(camp.title);
    setFormDesc(camp.description);
    setFormCta(camp.ctaText);
    setFormDestinationUrl(camp.destinationUrl);
    setFormPriority(camp.priority || 1);
    setFormStatus(camp.status === 'completed' ? 'paused' : camp.status);
    setFormStartDate(camp.startDate ? camp.startDate.split('T')[0]! : '');
    setFormEndDate(camp.endDate ? camp.endDate.split('T')[0]! : '');

    const firstCreative = camp.creatives?.[0];
    const assetUrl = firstCreative?.imageUrl || firstCreative?.videoUrl || firstCreative?.animationUrl || '';
    setMediaAssetUrl(assetUrl);
    setMediaThumbnailUrl(firstCreative?.thumbnailUrl || '');
    setMediaStoragePath(firstCreative?.storagePath || '');
    setMediaMimeType(firstCreative?.mimeType || '');
    setMediaFileSizeBytes(firstCreative?.fileSizeBytes || 0);
    setMediaWidth(firstCreative?.width);
    setMediaHeight(firstCreative?.height);
    setMediaDurationSeconds(firstCreative?.durationSeconds);

    if (firstCreative?.carouselItems && firstCreative.carouselItems.length > 0) {
      setCarouselItems(firstCreative.carouselItems);
    } else {
      setCarouselItems([
        {
          id: `slide_${Date.now()}_1`,
          imageUrl: assetUrl,
          title: camp.title,
          description: camp.description,
          ctaText: camp.ctaText,
          destinationUrl: camp.destinationUrl,
        },
      ]);
    }

    setIsUploading(false);
    setUploadProgress(null);
    setUploadError(null);
    setActiveCarouselSlide(0);
    setPreviewFormat('native');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  // Upload Primary Asset Handler
  const handlePrimaryFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const category = formCreativeType === 'video' ? 'video' : formCreativeType === 'animated' ? 'animated' : 'image';
    const validation = validateCreativeFile(file, category);
    if (!validation.valid) {
      setUploadError(validation.error || 'Invalid file format or size limit exceeded.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(10);

    const campId = editingCampaign?.id || `camp_${Date.now()}`;

    try {
      const res: UploadedAssetResult = await uploadCreativeAsset(file, campId, 'primary', (progress) => {
        setUploadProgress(progress);
      });

      setMediaAssetUrl(res.downloadUrl);
      setMediaStoragePath(res.storagePath);
      setMediaMimeType(res.mimeType);
      setMediaFileSizeBytes(res.fileSizeBytes);
      setMediaWidth(res.width);
      setMediaHeight(res.height);
      setMediaDurationSeconds(res.durationSeconds);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 1200);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload creative asset.');
      setUploadProgress(null);
    } finally {
      setIsUploading(false);
      if (primaryFileInputRef.current) primaryFileInputRef.current.value = '';
    }
  };

  // Upload Video Thumbnail Handler
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateCreativeFile(file, 'image');
    if (!validation.valid) {
      setUploadError(validation.error || 'Thumbnail must be a valid image (PNG/JPG/WebP).');
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    const campId = editingCampaign?.id || `camp_${Date.now()}`;

    try {
      const res: UploadedAssetResult = await uploadCreativeAsset(file, campId, 'thumbnails');
      setMediaThumbnailUrl(res.downloadUrl);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload video thumbnail.');
    } finally {
      setIsUploading(false);
      if (thumbnailFileInputRef.current) thumbnailFileInputRef.current.value = '';
    }
  };

  // Upload Single Carousel Slide Asset
  const handleCarouselSlideUpload = async (slideIndex: number, file: File) => {
    const validation = validateCreativeFile(file, 'image');
    if (!validation.valid) {
      setUploadError(validation.error || 'Slide asset must be an image.');
      return;
    }

    const campId = editingCampaign?.id || `camp_${Date.now()}`;
    setIsUploading(true);

    try {
      const res = await uploadCreativeAsset(file, campId, `carousel_${slideIndex}`);
      setCarouselItems((prev) => {
        const next = [...prev];
        if (next[slideIndex]) {
          next[slideIndex] = { ...next[slideIndex]!, imageUrl: res.downloadUrl };
        }
        return next;
      });
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload carousel card image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTogglePlacement = (fmt: AdFormat) => {
    setFormPlacements((prev) => {
      if (prev.includes(fmt)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((f) => f !== fmt);
      } else {
        return [...prev, fmt];
      }
    });
  };

  const handleAddCarouselSlide = () => {
    setCarouselItems((prev) => [
      ...prev,
      {
        id: `slide_${Date.now()}_${prev.length + 1}`,
        imageUrl: '',
        title: `Card ${prev.length + 1}`,
        description: 'Highlight an additional feature or reward.',
        ctaText: formCta || 'Learn More',
        destinationUrl: formDestinationUrl || '',
      },
    ]);
    setActiveCarouselSlide(carouselItems.length);
  };

  const handleRemoveCarouselSlide = (idx: number) => {
    if (carouselItems.length <= 1) return;
    setCarouselItems((prev) => prev.filter((_, i) => i !== idx));
    if (activeCarouselSlide >= carouselItems.length - 1) {
      setActiveCarouselSlide(Math.max(0, carouselItems.length - 2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTargetApp) {
      setErrorMessage('Please select a Target Application.');
      return;
    }

    if (!formTitle.trim()) {
      setErrorMessage('Ad title / headline is required.');
      return;
    }

    if (!isValidDestination(formDestinationUrl)) {
      setErrorMessage('Please provide a valid Destination URL (https://) or App Deep Link (e.g. app://screen or filezen://open).');
      return;
    }

    if (formPlacements.length === 0) {
      setErrorMessage('Please select at least one ad format placement.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };

    const campaignId = editingCampaign?.id || `camp_${Date.now()}`;
    const nowIso = new Date().toISOString();

    // Construct primary creative item
    const creative: CustomAdCreative = {
      id: `cr_${campaignId}_main`,
      campaignId,
      format: (formPlacements[0] as 'banner' | 'native' | 'video' | 'interstitial') || 'native',
      creativeType: formCreativeType,
      title: formTitle.trim(),
      headline: formTitle.trim(),
      bodyText: formDesc.trim(),
      callToAction: formCta.trim(),
      destinationUrl: formDestinationUrl.trim(),
      imageUrl: formCreativeType === 'video' ? mediaThumbnailUrl || mediaAssetUrl : mediaAssetUrl || undefined,
      videoUrl: formCreativeType === 'video' ? mediaAssetUrl : undefined,
      thumbnailUrl: mediaThumbnailUrl || undefined,
      animationUrl: formCreativeType === 'animated' ? mediaAssetUrl : undefined,
      animationType: mediaMimeType.includes('json') ? 'lottie' : 'gif',
      storagePath: mediaStoragePath || undefined,
      mimeType: mediaMimeType || undefined,
      fileSizeBytes: mediaFileSizeBytes || undefined,
      width: mediaWidth,
      height: mediaHeight,
      durationSeconds: mediaDurationSeconds,
      carouselItems: formCreativeType === 'carousel' ? carouselItems : undefined,
      createdAt: editingCampaign?.creatives?.[0]?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    try {
      if (editingCampaign) {
        await updateCustomAdCampaign(
          editingCampaign.id,
          {
            title: formName.trim() || formTitle.trim(),
            description: formDesc.trim(),
            ctaText: formCta.trim(),
            destinationUrl: formDestinationUrl.trim(),
            targetAppId: formTargetApp,
            targetApps: [formTargetApp],
            creativeType: formCreativeType,
            placements: formPlacements,
            startDate: formStartDate ? new Date(formStartDate).toISOString() : editingCampaign.startDate,
            endDate: formEndDate ? new Date(formEndDate).toISOString() : editingCampaign.endDate,
            status: formStatus,
            priority: formPriority,
            creatives: [creative],
          },
          actor,
        );
      } else {
        await createCustomAdCampaign(
          {
            id: campaignId,
            title: formName.trim() || formTitle.trim(),
            description: formDesc.trim(),
            ctaText: formCta.trim(),
            destinationUrl: formDestinationUrl.trim(),
            targetAppId: formTargetApp,
            targetApps: [formTargetApp],
            creativeType: formCreativeType,
            placements: formPlacements,
            status: formStatus,
            priority: formPriority,
            enabled: formStatus === 'active',
            impressionsCount: 0,
            clicksCount: 0,
            startDate: formStartDate ? new Date(formStartDate).toISOString() : nowIso,
            endDate: formEndDate ? new Date(formEndDate).toISOString() : new Date(Date.now() + 365 * 86400000).toISOString(),
            creatives: [creative],
          },
          actor,
        );
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save custom ad campaign.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (camp: CustomAdCampaign) => {
    const nextStatus = camp.status === 'active' ? 'paused' : 'active';
    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };
    try {
      await updateCustomAdCampaign(camp.id, { status: nextStatus, enabled: nextStatus === 'active' }, actor);
    } catch (err) {
      console.error('Failed to toggle campaign status:', err);
    }
  };

  const handleDelete = async (camp: CustomAdCampaign) => {
    if (!confirm(`Delete custom campaign "${camp.title}"?`)) return;
    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };
    try {
      await deleteCustomAdCampaign(camp.id, actor);
    } catch (err) {
      console.error('Failed to delete campaign:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-xs text-emerald-950 dark:text-emerald-200">
              WebAppyPie First-Party Custom House Ads & Creatives
            </h4>
            <p className="text-xs text-emerald-800 dark:text-emerald-300">
              Serve dynamic cross-promotions, app installs, and rich media (image, video, Lottie animations, carousels) without third-party network fees.
              Campaigns are app-centric and act as zero-commission fallbacks when waterfall fill rate drops.
            </p>
          </div>
        </div>
        {hasRole('editor') && (
          <Button
            size="sm"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 shrink-0"
            disabled={apps.length === 0}
          >
            <Plus className="h-4 w-4" />
            Create Custom Ad
          </Button>
        )}
      </div>

      {apps.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>No registered applications detected in Firestore. Add your first app under Applications to begin serving custom ads.</span>
        </div>
      )}

      {/* Campaigns Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Active & Scheduled In-House Campaigns ({campaigns.length})
          </CardTitle>
          <p className="text-xs text-slate-500">
            Real first-party house inventory tracked live from Firestore.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Target App</TableHead>
                <TableHead>Creative Type</TableHead>
                <TableHead>Placements</TableHead>
                <TableHead>CTA</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Impressions</TableHead>
                <TableHead>Clicks (CTR)</TableHead>
                <TableHead>Priority</TableHead>
                {hasRole('editor') && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-xs text-slate-500">
                    No custom ad campaigns created yet. Click "Create Custom Ad" to launch your first dynamic creative.
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((camp) => {
                  const targetAppId = camp.targetAppId || camp.targetApps[0];
                  const matchedApp = apps.find((a) => a.id === targetAppId || camp.targetApps.includes(a.id));
                  const appDisplayName = matchedApp ? matchedApp.name : targetAppId || 'Global';
                  const cType = camp.creativeType || (camp.creatives?.[0]?.creativeType as CreativeType) || 'image';
                  const placements = camp.placements && camp.placements.length > 0 ? camp.placements : ['banner', 'native'];
                  const ctr =
                    camp.impressionsCount > 0
                      ? ((camp.clicksCount / camp.impressionsCount) * 100).toFixed(2)
                      : '0.00';

                  const firstCr = camp.creatives?.[0];
                  const thumb = firstCr?.thumbnailUrl || firstCr?.imageUrl;

                  return (
                    <TableRow key={camp.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              className="h-8 w-8 rounded object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                              <Smartphone className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-xs text-slate-900 dark:text-white">
                              {camp.title}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-xs">
                              {camp.description}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-medium">
                          {appDisplayName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          {cType.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[140px]">
                          {placements.map((p) => (
                            <Badge key={p} variant="secondary" className="text-[9px] px-1 py-0">
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {camp.ctaText}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-600 dark:text-slate-400 max-w-[120px] truncate" title={camp.destinationUrl}>
                          <span className="truncate">{camp.destinationUrl}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleStatus(camp)}
                          disabled={!hasRole('editor')}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            camp.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {camp.status === 'active' ? (
                            <Play className="h-2.5 w-2.5 fill-current" />
                          ) : (
                            <Pause className="h-2.5 w-2.5 fill-current" />
                          )}
                          {camp.status}
                        </button>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                        {camp.impressionsCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                        {camp.clicksCount.toLocaleString()}{' '}
                        <span className="text-[10px] text-emerald-600 font-semibold">({ctr}%)</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        #{camp.priority}
                      </TableCell>
                      {hasRole('editor') && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditModal(camp)}
                              className="p-1 text-slate-500 hover:text-slate-700"
                              title="Edit campaign"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(camp)}
                              className="p-1 text-red-500 hover:text-red-700"
                              title="Delete campaign"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Redesigned Production 3-Section Modal: Fixed Header, Scrollable 2-Col Body, Fixed Footer */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-ad-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsModalOpen(false)}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div className="relative z-10 flex flex-col w-[calc(100vw-24px)] sm:w-full max-w-[1180px] h-[calc(100vh-24px)] sm:h-[calc(100vh-48px)] max-h-[880px] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            {/* 1. FIXED HEADER */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <div>
                <h2
                  id="custom-ad-modal-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  {editingCampaign ? `Edit Custom Ad: ${editingCampaign.title}` : 'Create Custom Ad Campaign'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure app-centric house creative assets, interactive placements, and deep-link destinations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 2. SCROLLABLE BODY (Only one vertical scrollbar) */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <form
                id="custom-ad-form"
                onSubmit={handleSubmit}
                className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)] gap-6 items-start"
              >
                {/* LEFT COLUMN: Form Inputs (~60%) */}
                <div className="space-y-4">
                  {errorMessage && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 dark:bg-red-950/60 dark:border-red-900 dark:text-red-300 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Section A: Campaign Identity */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900/50 space-y-3.5">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-600" /> Campaign Identity
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Campaign Internal Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Cross-Promote OptiLens AI Camera in FileZen"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Target App (Host Display)
                          </label>
                          <select
                            value={formTargetApp}
                            onChange={(e) => handleAppChange(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            {apps.map((app) => (
                              <option key={app.id} value={app.id}>
                                {app.name} ({app.packageId})
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-[10px] text-slate-500">
                            Strict app isolation: only served within this application.
                          </p>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Campaign Priority (Higher wins)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={formPriority}
                            onChange={(e) => setFormPriority(parseInt(e.target.value, 10) || 1)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section B: Creative Type & Placements */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900/50 space-y-3.5">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-600" /> Format & Placements
                    </div>

                    {/* Creative Type Cards (5 compact cards) */}
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                        Creative Type
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {CREATIVE_TYPES.map((t) => {
                          const Icon = t.icon;
                          const isSelected = formCreativeType === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setFormCreativeType(t.id)}
                              className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border text-center transition-all ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300 ring-2 ring-indigo-500/20 shadow-sm font-semibold'
                                  : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60 dark:text-slate-300'
                              }`}
                            >
                              <Icon className="h-4 w-4 mb-1" />
                              <span className="text-xs leading-tight font-medium">{t.label}</span>
                              <span className="text-[9px] opacity-70 mt-0.5 truncate max-w-full">
                                {t.formatHint}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Placement Chips */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Placements (Available for {selectedApp?.name || 'Selected App'})
                        </label>
                        <span className="text-[10px] text-slate-400">
                          {formPlacements.length} selected
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {availableFormatsForApp.map((fmt) => {
                          const isChecked = formPlacements.includes(fmt.id);
                          return (
                            <button
                              key={fmt.id}
                              type="button"
                              onClick={() => handleTogglePlacement(fmt.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5 ${
                                isChecked
                                  ? 'border-indigo-600 bg-indigo-600 text-white font-medium shadow-sm'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                              }`}
                            >
                              {isChecked && <Check className="h-3 w-3 stroke-[2.5]" />}
                              <span>{fmt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Section C: Creative Upload Area */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900/50 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-indigo-600" />
                        {formCreativeType === 'video'
                          ? 'Video & Poster Upload'
                          : formCreativeType === 'animated'
                          ? 'Animation Upload (GIF / Lottie)'
                          : formCreativeType === 'carousel'
                          ? 'Carousel Deck Editor'
                          : 'Image Creative Upload'}
                      </div>
                      {mediaFileSizeBytes > 0 && formCreativeType !== 'carousel' && (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {(mediaFileSizeBytes / 1024).toFixed(1)} KB
                          {mediaWidth && mediaHeight ? ` • ${mediaWidth}×${mediaHeight}` : ''}
                          {mediaDurationSeconds ? ` • ${mediaDurationSeconds}s` : ''}
                        </span>
                      )}
                    </div>

                    {uploadError && (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
                        {uploadError}
                      </div>
                    )}

                    {/* Upload Dropzone */}
                    {formCreativeType !== 'carousel' ? (
                      <div className="space-y-3">
                        <input
                          ref={primaryFileInputRef}
                          type="file"
                          className="hidden"
                          accept={
                            formCreativeType === 'video'
                              ? 'video/mp4,video/webm'
                              : formCreativeType === 'animated'
                              ? 'image/gif,application/json,.json'
                              : 'image/png,image/jpeg,image/webp,image/gif'
                          }
                          onChange={handlePrimaryFileUpload}
                        />

                        {mediaAssetUrl ? (
                          /* Asset Already Uploaded Card */
                          <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                            <div className="flex items-center gap-3 overflow-hidden">
                              {formCreativeType === 'video' ? (
                                <div className="h-10 w-10 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center shrink-0">
                                  <Video className="h-5 w-5" />
                                </div>
                              ) : (
                                <img
                                  src={mediaAssetUrl}
                                  alt="Creative preview"
                                  className="h-10 w-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                />
                              )}
                              <div className="truncate">
                                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                  {mediaStoragePath.split('/').pop() || 'Creative Asset Attached'}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {mediaMimeType || 'asset'} • {(mediaFileSizeBytes / 1024).toFixed(1)} KB
                                  {mediaWidth && mediaHeight ? ` • ${mediaWidth}×${mediaHeight}px` : ''}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => primaryFileInputRef.current?.click()}
                                disabled={isUploading}
                                className="text-xs h-8"
                              >
                                Replace
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setMediaAssetUrl('');
                                  setMediaStoragePath('');
                                  setMediaFileSizeBytes(0);
                                  setMediaWidth(undefined);
                                  setMediaHeight(undefined);
                                  setMediaDurationSeconds(undefined);
                                }}
                                className="text-xs h-8 text-red-600 hover:text-red-700"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* Drag & Drop Upload Container */
                          <div
                            onClick={() => primaryFileInputRef.current?.click()}
                            className="cursor-pointer border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-all bg-slate-50/50 dark:bg-slate-800/40"
                          >
                            <Upload className="h-7 w-7 mx-auto text-indigo-500 mb-2" />
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {isUploading
                                ? 'Uploading to Firebase Storage...'
                                : 'Upload Creative Asset'}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1">
                              {formCreativeType === 'video'
                                ? 'MP4 or WebM video file (Max 50MB)'
                                : formCreativeType === 'animated'
                                ? 'GIF or Lottie JSON animation file (Max 10MB)'
                                : 'JPG, PNG, WebP image file (Max 10MB)'}
                            </p>
                            <span className="inline-block mt-3 px-3 py-1 rounded-md text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-sm">
                              Browse Files
                            </span>
                          </div>
                        )}

                        {/* Upload Progress Bar */}
                        {uploadProgress !== null && (
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-2 transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        )}

                        {/* Secondary Video Poster Upload */}
                        {formCreativeType === 'video' && (
                          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <input
                              ref={thumbnailFileInputRef}
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={handleThumbnailUpload}
                            />
                            <div>
                              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Video Poster / Thumbnail
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {mediaThumbnailUrl ? 'Custom poster image attached' : 'Optional display thumbnail while video loads'}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => thumbnailFileInputRef.current?.click()}
                              disabled={isUploading}
                              className="text-xs h-8"
                            >
                              {mediaThumbnailUrl ? 'Replace Poster' : 'Upload Poster'}
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Carousel Cards Manager */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            {carouselItems.length} slides configured
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddCarouselSlide}
                            className="text-xs h-8 flex items-center gap-1"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add Slide
                          </Button>
                        </div>

                        {carouselItems.map((slide, idx) => (
                          <div
                            key={slide.id}
                            className={`rounded-xl border p-3 transition-all ${
                              activeCarouselSlide === idx
                                ? 'border-indigo-500 bg-white dark:bg-slate-800 shadow-sm'
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <button
                                type="button"
                                onClick={() => setActiveCarouselSlide(idx)}
                                className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5"
                              >
                                <span className="h-4 w-4 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] flex items-center justify-center font-bold">
                                  {idx + 1}
                                </span>
                                {slide.title || `Slide #${idx + 1}`}
                              </button>
                              {carouselItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCarouselSlide(idx)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <input
                                type="text"
                                placeholder="Slide Headline"
                                value={slide.title || ''}
                                onChange={(e) => {
                                  const title = e.target.value;
                                  setCarouselItems((prev) =>
                                    prev.map((s, i) => (i === idx ? { ...s, title } : s)),
                                  );
                                }}
                                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium"
                              />
                              <input
                                type="text"
                                placeholder="Slide CTA"
                                value={slide.ctaText || ''}
                                onChange={(e) => {
                                  const ctaText = e.target.value;
                                  setCarouselItems((prev) =>
                                    prev.map((s, i) => (i === idx ? { ...s, ctaText } : s)),
                                  );
                                }}
                                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium"
                              />
                            </div>

                            <div className="mt-2.5 flex items-center justify-between">
                              <label className="text-xs font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline">
                                Upload Slide Image
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleCarouselSlideUpload(idx, file);
                                  }}
                                />
                              </label>
                              {slide.imageUrl && (
                                <span className="text-[10px] text-emerald-600 font-mono flex items-center gap-1">
                                  <FileCheck className="h-3.5 w-3.5" /> Image attached
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section D: Ad Copy & Actions */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900/50 space-y-3.5">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-600" /> Ad Copy & Destination
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Ad Headline / Title
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Upgrade to OptiLens Pro AI Camera"
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Body Description
                        </label>
                        <textarea
                          rows={2}
                          required
                          placeholder="e.g. Crystal-clear AI photography and document enhancement tools."
                          value={formDesc}
                          onChange={(e) => setFormDesc(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-normal text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            CTA Button Text
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Install Free"
                            value={formCta}
                            onChange={(e) => setFormCta(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Destination URL or Deep Link
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. https://webappypie.com/optilens or app://upgrade"
                            value={formDestinationUrl}
                            onChange={(e) => setFormDestinationUrl(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section E: Dates & Status */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900/50 space-y-3">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-600" /> Schedule & Lifecycle
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={formStartDate}
                          onChange={(e) => setFormStartDate(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={formEndDate}
                          onChange={(e) => setFormEndDate(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Campaign Status
                        </label>
                        <select
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value as 'active' | 'paused')}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium"
                        >
                          <option value="active">Active (Serving)</option>
                          <option value="paused">Paused</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Sticky Live Preview (~40%) */}
                <div className="lg:sticky lg:top-0 space-y-3">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4.5 space-y-3.5 shadow-sm">
                    {/* Preview Header & Format Switcher */}
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                          <Eye className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Live Preview
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setPreviewFormat('banner')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            previewFormat === 'banner'
                              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          Banner
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewFormat('native')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            previewFormat === 'native'
                              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          Native
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewFormat('interstitial')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            previewFormat === 'interstitial'
                              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          Interstitial
                        </button>
                      </div>
                    </div>

                    {/* Simulated Preview Area */}
                    <div className="flex flex-col justify-center items-center py-2 min-h-[380px]">
                      {/* 1. BANNER PREVIEW */}
                      {previewFormat === 'banner' && (
                        <div className="w-full max-w-[360px] h-[64px] rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/90 dark:bg-indigo-950/60 p-2.5 flex items-center justify-between gap-2.5 shadow-sm">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            {mediaAssetUrl && formCreativeType !== 'video' ? (
                              <img
                                src={mediaAssetUrl}
                                alt="Banner graphic"
                                className="h-11 w-11 rounded-lg object-cover shrink-0 border border-indigo-200 dark:border-indigo-800"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                PROMO
                              </div>
                            )}
                            <div className="truncate">
                              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {formTitle || 'Your Headline Here'}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {formDesc || 'Exclusive first-party cross promo'}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shrink-0 shadow-sm"
                          >
                            {formCta || 'Install'}
                          </button>
                        </div>
                      )}

                      {/* 2. NATIVE CARD PREVIEW */}
                      {previewFormat === 'native' && (
                        <div className="w-full max-w-[350px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
                          {/* Media Header */}
                          {formCreativeType === 'video' ? (
                            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                              {mediaAssetUrl ? (
                                <video
                                  src={mediaAssetUrl}
                                  poster={mediaThumbnailUrl || undefined}
                                  autoPlay
                                  muted
                                  loop
                                  controls
                                  playsInline
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="text-center text-slate-500">
                                  <Video className="h-8 w-8 mx-auto mb-1 opacity-50" />
                                  <span className="text-[10px]">Video placeholder</span>
                                </div>
                              )}
                              <span className="absolute top-2.5 left-2.5 rounded bg-black/60 backdrop-blur px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                                Featured Video
                              </span>
                            </div>
                          ) : formCreativeType === 'carousel' ? (
                            /* Carousel Slide View */
                            <div className="relative aspect-video bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                              {carouselItems[activeCarouselSlide]?.imageUrl ? (
                                <img
                                  src={carouselItems[activeCarouselSlide]!.imageUrl}
                                  alt="Carousel slide"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="text-center text-slate-400">
                                  <Layers className="h-8 w-8 mx-auto mb-1 opacity-40" />
                                  <span className="text-[10px]">Carousel slide {activeCarouselSlide + 1}</span>
                                </div>
                              )}
                              {carouselItems.length > 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveCarouselSlide((prev) =>
                                        prev > 0 ? prev - 1 : carouselItems.length - 1,
                                      )
                                    }
                                    className="absolute left-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveCarouselSlide((prev) =>
                                        prev < carouselItems.length - 1 ? prev + 1 : 0,
                                      )
                                    }
                                    className="absolute right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[9px] font-mono text-white">
                                {activeCarouselSlide + 1} / {carouselItems.length}
                              </span>
                            </div>
                          ) : (
                            /* Standard Image / Animated View */
                            <div className="relative aspect-video bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                              {mediaAssetUrl ? (
                                <img
                                  src={mediaAssetUrl}
                                  alt="Ad creative"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="text-center text-slate-400">
                                  <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-40" />
                                  <span className="text-[10px]">Creative preview graphic</span>
                                </div>
                              )}
                              <span className="absolute top-2.5 left-2.5 rounded bg-black/60 backdrop-blur px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                                Promoted
                              </span>
                            </div>
                          )}

                          {/* Card Content */}
                          <div className="p-4 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                {selectedApp?.name || 'WebAppyPie'}
                              </span>
                              <span className="text-[9px] text-slate-400">Sponsored</span>
                            </div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                              {formCreativeType === 'carousel' && carouselItems[activeCarouselSlide]?.title
                                ? carouselItems[activeCarouselSlide]!.title
                                : formTitle || 'Your Compelling Headline'}
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                              {formCreativeType === 'carousel' && carouselItems[activeCarouselSlide]?.description
                                ? carouselItems[activeCarouselSlide]!.description
                                : formDesc || 'App description highlighting transformative benefits.'}
                            </div>
                            <div className="pt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                              <span className="text-[10px] font-mono text-slate-400 truncate max-w-[170px]">
                                {formDestinationUrl || 'Destination'}
                              </span>
                              <button
                                type="button"
                                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm"
                              >
                                {formCreativeType === 'carousel' && carouselItems[activeCarouselSlide]?.ctaText
                                  ? carouselItems[activeCarouselSlide]!.ctaText
                                  : formCta || 'Install Free'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 3. INTERSTITIAL PREVIEW */}
                      {previewFormat === 'interstitial' && (
                        <div className="w-full max-w-[280px] h-[440px] rounded-3xl border-4 border-slate-800 bg-slate-950 p-3 shadow-2xl flex flex-col justify-between overflow-hidden relative">
                          <div className="flex items-center justify-between px-2 pt-1 text-white">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-400">
                              House Ad
                            </span>
                            <span className="h-5 w-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300">
                              ✕
                            </span>
                          </div>

                          <div className="my-auto text-center space-y-3 px-2">
                            {mediaAssetUrl ? (
                              formCreativeType === 'video' ? (
                                <video
                                  src={mediaAssetUrl}
                                  autoPlay
                                  muted
                                  loop
                                  playsInline
                                  className="max-h-44 w-full rounded-xl object-cover mx-auto"
                                />
                              ) : (
                                <img
                                  src={mediaAssetUrl}
                                  alt="Interstitial asset"
                                  className="max-h-44 rounded-xl object-contain mx-auto shadow"
                                />
                              )
                            ) : (
                              <div className="h-32 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 text-xs">
                                Asset Graphic
                              </div>
                            )}
                            <div>
                              <h4 className="text-sm font-bold text-white">
                                {formTitle || 'Headline Title'}
                              </h4>
                              <p className="text-[11px] text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                                {formDesc || 'Your full interstitial message copy.'}
                              </p>
                            </div>
                          </div>

                          <div className="p-1">
                            <button
                              type="button"
                              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg"
                            >
                              {formCta || 'Install Free'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-center text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-2">
                      Live binding with current asset, headline, description, and CTA.
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* 3. FIXED FOOTER */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 shrink-0">
              <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                {formTargetApp ? (
                  <span>Targeting: <strong className="text-slate-700 dark:text-slate-200">{selectedApp?.name || formTargetApp}</strong></span>
                ) : (
                  <span>Select a target app</span>
                )}
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="custom-ad-form"
                  size="sm"
                  disabled={isSubmitting || isUploading}
                  className="flex items-center gap-2"
                >
                  {isSubmitting
                    ? 'Saving Changes...'
                    : editingCampaign
                    ? 'Update Custom Ad'
                    : 'Create Custom Ad'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
