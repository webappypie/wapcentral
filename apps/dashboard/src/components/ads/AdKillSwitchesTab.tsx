import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Modal,
} from '@wapcentral/ui';
import {
  Power,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Layers,
  Smartphone,
  Eye,
  Activity,
} from 'lucide-react';
import type {
  AdKillSwitches,
  AdNetwork,
  AdAppConfig,
  AdFormat,
} from '@wapcentral/types';
import { updateAdKillSwitches } from '../../services/adsService.js';
import { useAuth } from '../../contexts/AuthContext.js';

interface AdKillSwitchesTabProps {
  killSwitches: AdKillSwitches;
  networks: AdNetwork[];
  apps: AdAppConfig[];
}

const ALL_FORMATS: AdFormat[] = [
  'banner',
  'native',
  'interstitial',
  'rewarded',
  'app_open',
  'rewarded_interstitial',
];

export const AdKillSwitchesTab: React.FC<AdKillSwitchesTabProps> = ({
  killSwitches,
  networks,
  apps,
}) => {
  const { user, hasRole } = useAuth();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'global' | 'network' | 'app' | 'format' | 'custom_ads';
    id?: string | undefined;
    newVal: boolean;
    label: string;
  } | null>(null);

  const [reason, setReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const isGlobalKilled = Boolean(killSwitches.globalAdsDisabled);

  const promptToggle = (
    type: 'global' | 'network' | 'app' | 'format' | 'custom_ads',
    id: string | undefined,
    currentVal: boolean,
    label: string,
  ) => {
    setPendingAction({
      type,
      id,
      newVal: !currentVal,
      label,
    });
    setReason('');
    setConfirmModalOpen(true);
  };

  const executeToggle = async () => {
    if (!pendingAction) return;
    setIsUpdating(true);

    const actor = {
      uid: user?.uid || 'usr_admin',
      email: user?.email || 'admin@webappypie.com',
    };

    try {
      if (pendingAction.type === 'global') {
        await updateAdKillSwitches(
          {
            globalAdsDisabled: pendingAction.newVal,
            reason: reason.trim() || undefined,
          },
          actor,
        );
      } else if (pendingAction.type === 'network' && pendingAction.id) {
        await updateAdKillSwitches(
          {
            networks: { [pendingAction.id]: pendingAction.newVal },
            reason: reason.trim() || undefined,
          },
          actor,
        );
      } else if (pendingAction.type === 'app' && pendingAction.id) {
        await updateAdKillSwitches(
          {
            apps: { [pendingAction.id]: pendingAction.newVal },
            reason: reason.trim() || undefined,
          },
          actor,
        );
      } else if (pendingAction.type === 'format' && pendingAction.id) {
        await updateAdKillSwitches(
          {
            formats: { [pendingAction.id]: pendingAction.newVal },
            reason: reason.trim() || undefined,
          },
          actor,
        );
      } else if (pendingAction.type === 'custom_ads') {
        await updateAdKillSwitches(
          {
            customAdsDisabled: pendingAction.newVal,
            reason: reason.trim() || undefined,
          },
          actor,
        );
      }
      setConfirmModalOpen(false);
    } catch (err) {
      console.error('Failed to update kill switch:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time Propagation Info */}
      <div className="rounded-lg border border-red-200 bg-red-50/70 p-4 dark:border-red-900/60 dark:bg-red-950/40">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-xs text-red-950 dark:text-red-200">
              Immediate Safety Hierarchy Propagation
            </h4>
            <p className="text-xs text-red-800 dark:text-red-300">
              Kill switch state overrides all lower-level configurations instantaneously in the 6-stage Effective Config Resolver.
              Consuming mobile apps (FileZen, OptiLens, etc.) hitting <code>/api/platform/v1/ads/config</code> will immediately cease ad requests without needing an app update or rebuild.
            </p>
          </div>
        </div>
      </div>

      {/* MASTER GLOBAL ADS OFF KILL SWITCH */}
      <Card
        className={`border-2 transition-all ${
          isGlobalKilled
            ? 'border-red-500 bg-red-50/60 dark:bg-red-950/40'
            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
        }`}
      >
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`rounded-2xl p-4 ${
                  isGlobalKilled
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Power className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    GLOBAL ADS KILL SWITCH
                  </h3>
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs uppercase ${
                      isGlobalKilled
                        ? 'border-red-400 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                        : 'border-emerald-300 text-emerald-700'
                    }`}
                  >
                    {isGlobalKilled ? 'KILL SWITCH ENGAGED' : 'SYSTEM NORMAL (OFF)'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500 max-w-xl">
                  {isGlobalKilled
                    ? 'CRITICAL: ALL ads across every single registered app and network are forcefully suppressed.'
                    : 'Engaging this switch will immediately stop all ad serving across FileZen, OptiLens, and all games.'}
                </p>
                {killSwitches.updatedAt && (
                  <p className="mt-2 text-[11px] text-slate-400 font-mono">
                    Last modified: {new Date(killSwitches.updatedAt).toLocaleString()} by {killSwitches.updatedBy || 'admin'}
                  </p>
                )}
              </div>
            </div>

            {hasRole('admin') ? (
              <Button
                variant={isGlobalKilled ? 'outline' : 'primary'}
                size="md"
                onClick={() =>
                  promptToggle(
                    'global',
                    undefined,
                    isGlobalKilled,
                    isGlobalKilled ? 'Restore Global Ads' : 'ENGAGE GLOBAL KILL SWITCH',
                  )
                }
                className={`font-bold text-xs uppercase px-5 py-2.5 ${
                  isGlobalKilled
                    ? 'border-emerald-500 text-emerald-700 hover:bg-emerald-50'
                    : 'bg-red-600 hover:bg-red-700 text-white shadow-md'
                }`}
              >
                <Power className="h-4 w-4 mr-2" />
                {isGlobalKilled ? 'Disengage Kill Switch' : 'KILL ALL ADS NOW'}
              </Button>
            ) : (
              <Badge variant="outline" className="text-slate-400">
                Admin Role Required
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Granular Kill Switches: Networks & Apps */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Network Kill Switches */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Ad Network Kill Switches</CardTitle>
            <p className="text-xs text-slate-500">
              Isolate and kill individual third-party ad networks (e.g. during an outage or SDK incident).
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {networks.map((net) => {
              const isKilled = Boolean(killSwitches.networks[net.id]);
              return (
                <div
                  key={net.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                      {net.name}
                    </h4>
                    <p className="font-mono text-[10px] text-slate-400">{net.id}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!hasRole('admin')}
                    onClick={() =>
                      promptToggle('network', net.id, isKilled, `${net.name} (${net.id})`)
                    }
                    className={`h-7 px-3 text-xs font-semibold ${
                      isKilled
                        ? 'border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isKilled ? 'Killed (Restore)' : 'Kill Network'}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* App Kill Switches */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Application Kill Switches</CardTitle>
            <p className="text-xs text-slate-500">
              Shut down monetization for a specific application without impacting others.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {apps.map((app) => {
              const isKilled = Boolean(killSwitches.apps[app.appId]);
              return (
                <div
                  key={app.appId}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                      {app.appName}
                    </h4>
                    <p className="font-mono text-[10px] text-slate-400">{app.appId}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!hasRole('admin')}
                    onClick={() =>
                      promptToggle('app', app.appId, isKilled, `${app.appName} (${app.appId})`)
                    }
                    className={`h-7 px-3 text-xs font-semibold ${
                      isKilled
                        ? 'border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isKilled ? 'Killed (Restore)' : 'Kill App Ads'}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Format Kill Switches */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Ad Format Kill Switches</CardTitle>
          <p className="text-xs text-slate-500">
            Emergency suppression of specific ad formats across all apps (e.g. if an interstitial crash is reported).
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ALL_FORMATS.map((fmt) => {
              const isKilled = Boolean(killSwitches.formats[fmt]);
              return (
                <div
                  key={fmt}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <span className="capitalize text-xs font-medium text-slate-800 dark:text-slate-200">
                    {fmt.replace('_', ' ')}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!hasRole('admin')}
                    onClick={() => promptToggle('format', fmt, isKilled, fmt)}
                    className={`h-6 px-2 text-[10px] font-semibold ${
                      isKilled
                        ? 'border-red-400 text-red-600 hover:bg-red-50'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isKilled ? 'Killed' : 'Kill'}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Custom Ads Kill Switch */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                House Ads Inventory Kill Switch
              </h4>
              <p className="text-xs text-slate-500">
                Immediately halts all WebAppyPie custom cross-promotion campaigns and house creatives.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!hasRole('admin')}
              onClick={() =>
                promptToggle(
                  'custom_ads',
                  undefined,
                  Boolean(killSwitches.customAdsDisabled),
                  'WebAppyPie Custom Ads',
                )
              }
              className={`h-8 px-3 text-xs font-semibold ${
                killSwitches.customAdsDisabled
                  ? 'border-red-400 text-red-600 hover:bg-red-50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {killSwitches.customAdsDisabled ? 'Custom Ads Killed (Restore)' : 'Kill Custom Ads'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title={`Confirm Kill Switch Action: ${pendingAction?.label}`}
      >
        <div className="space-y-4">
          <div className="rounded bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>
              This will immediately alter effective ad resolution for all live mobile app clients consuming this service.
            </span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Audit Reason (Required for Audit Trail)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Investigation into creative quality issue or SDK crash report"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isUpdating}
              onClick={executeToggle}
              className={pendingAction?.newVal ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
            >
              {isUpdating ? 'Applying...' : 'Confirm Action'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
