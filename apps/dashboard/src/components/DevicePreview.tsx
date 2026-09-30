import React from 'react';
import type { LayoutVariant } from '@wapcentral/types';
import { Sparkles, X, ExternalLink, ArrowRight, ShieldCheck } from 'lucide-react';

export interface DevicePreviewProps {
  layoutVariant: LayoutVariant;
  title: string;
  description: string;
  ctaText: string;
  imageUrl?: string | undefined;
  storeUrl?: string | undefined;
  appName?: string | undefined;
  bannerPosition?: 'top' | 'bottom' | undefined;
  className?: string | undefined;
}

export const DevicePreview: React.FC<DevicePreviewProps> = ({
  layoutVariant,
  title,
  description,
  ctaText,
  imageUrl,
  storeUrl,
  appName = 'WebAppyPie App',
  bannerPosition = 'bottom',
  className = '',
}) => {
  const displayTitle = title || 'Special Offer';
  const displayDescription =
    description || 'Discover powerful new features to supercharge your workflow today.';
  const displayCta = ctaText || 'Learn More';
  const displayImage =
    imageUrl ||
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60';

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Device Frame */}
      <div className="relative w-[300px] h-[600px] rounded-[44px] bg-slate-900 p-3 shadow-2xl border-4 border-slate-700/80 ring-1 ring-slate-900/50">
        {/* Dynamic Island / Notch */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 h-5 w-24 rounded-full bg-black flex items-center justify-between px-2">
          <div className="h-2.5 w-2.5 rounded-full bg-slate-800" />
          <div className="h-2 w-2 rounded-full bg-blue-500/80" />
        </div>

        {/* Screen Bezel / Container */}
        <div className="relative h-full w-full overflow-hidden rounded-[34px] bg-slate-950 text-white flex flex-col font-sans">
          {/* Status Bar */}
          <div className="flex items-center justify-between px-6 pt-3 text-[11px] font-medium text-slate-300 z-20">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px]">5G</span>
              <div className="h-2.5 w-4 rounded-sm border border-slate-300 p-0.5 flex items-center">
                <div className="h-full w-full bg-emerald-400 rounded-2xs" />
              </div>
            </div>
          </div>

          {/* App Header (Mock) */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm z-10">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-[10px] font-bold">
                W
              </div>
              <span className="text-xs font-semibold tracking-tight text-slate-200 truncate max-w-[140px]">
                {appName}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Verified</span>
            </div>
          </div>

          {/* Screen Content Body */}
          <div className="relative flex-1 overflow-y-auto px-4 py-3 text-slate-400 flex flex-col gap-3">
            {/* Top Banner if layout is banner and bannerPosition is top */}
            {layoutVariant === 'banner' && bannerPosition === 'top' && (
              <div className="z-20 -mx-2 mb-2 p-2.5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-brand-500/40 shadow-lg flex items-center gap-3">
                <img
                  src={displayImage}
                  alt={displayTitle}
                  className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-slate-700"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-semibold bg-brand-500/20 text-brand-300 px-1 py-0.2 rounded">
                      AD
                    </span>
                    <h4 className="text-xs font-bold text-white truncate">{displayTitle}</h4>
                  </div>
                  <p className="text-[10px] text-slate-300 line-clamp-1 mt-0.5">
                    {displayDescription}
                  </p>
                </div>
                <button
                  type="button"
                  className="px-2.5 py-1 text-[10px] font-semibold bg-brand-500 hover:bg-brand-600 text-white rounded-md shadow flex-shrink-0 flex items-center gap-1"
                >
                  {displayCta}
                  <ArrowRight className="w-2.5 h-2.5" />
                </button>
              </div>
            )}

            {/* Mock Feed Content */}
            <div className="h-20 rounded-xl bg-slate-900/80 border border-slate-800/80 p-3 flex flex-col justify-center">
              <div className="h-3 w-3/4 bg-slate-800 rounded mb-2" />
              <div className="h-2 w-1/2 bg-slate-800/70 rounded" />
            </div>

            {/* Native In-Feed Placement */}
            {layoutVariant === 'native' && (
              <div className="my-1 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/90 border border-brand-500/40 p-3 shadow-lg flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-brand-400 bg-brand-500/20 px-1.5 py-0.5 rounded">
                      Promoted
                    </span>
                    <span className="text-[11px] text-slate-400">WebAppyPie Network</span>
                  </div>
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-800 bg-black/40">
                  <img
                    src={displayImage}
                    alt={displayTitle}
                    className="w-full h-28 object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>

                <div>
                  <h4 className="text-xs font-bold text-white line-clamp-1">{displayTitle}</h4>
                  <p className="text-[11px] text-slate-300 line-clamp-2 mt-1 leading-relaxed">
                    {displayDescription}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                    {storeUrl ? new URL(storeUrl).hostname : 'play.google.com'}
                  </span>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-[11px] font-medium bg-brand-500 hover:bg-brand-600 text-white rounded-lg shadow-sm flex items-center gap-1.5"
                  >
                    <span>{displayCta}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Additional Mock Cards */}
            <div className="h-16 rounded-xl bg-slate-900/60 border border-slate-800/60 p-3 flex flex-col justify-center">
              <div className="h-3 w-2/3 bg-slate-800 rounded mb-2" />
              <div className="h-2 w-1/3 bg-slate-800/70 rounded" />
            </div>

            <div className="h-16 rounded-xl bg-slate-900/60 border border-slate-800/60 p-3 flex flex-col justify-center">
              <div className="h-3 w-4/5 bg-slate-800 rounded mb-2" />
              <div className="h-2 w-2/5 bg-slate-800/70 rounded" />
            </div>

            {/* Bottom Banner if layout is banner and bannerPosition is bottom */}
            {layoutVariant === 'banner' && bannerPosition === 'bottom' && (
              <div className="sticky bottom-2 z-20 mt-auto p-2.5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-brand-500/50 shadow-2xl flex items-center gap-3 backdrop-blur-md">
                <img
                  src={displayImage}
                  alt={displayTitle}
                  className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-slate-700"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-bold bg-brand-500/30 text-brand-300 px-1 py-0.5 rounded">
                      AD
                    </span>
                    <h4 className="text-xs font-bold text-white truncate">{displayTitle}</h4>
                  </div>
                  <p className="text-[10px] text-slate-300 line-clamp-1 mt-0.5">
                    {displayDescription}
                  </p>
                </div>
                <button
                  type="button"
                  className="px-2.5 py-1.5 text-[10px] font-semibold bg-brand-500 hover:bg-brand-600 text-white rounded-md shadow-sm flex-shrink-0 flex items-center gap-1"
                >
                  {displayCta}
                </button>
              </div>
            )}
          </div>

          {/* Fullscreen Interstitial Overlay */}
          {layoutVariant === 'interstitial' && (
            <div className="absolute inset-0 z-30 bg-slate-950 flex flex-col animate-in fade-in duration-200">
              {/* Top Bar with Timer and Close Button */}
              <div className="flex items-center justify-between p-4 z-40 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full border border-white/10 text-[10px] text-slate-300">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Sponsored Promotion</span>
                </div>
                <button
                  type="button"
                  aria-label="Close Preview Ad"
                  className="h-7 w-7 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-slate-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Interstitial Hero Artwork */}
              <div className="relative flex-1 overflow-hidden flex items-center justify-center p-4">
                <div
                  className="absolute inset-0 bg-cover bg-center blur-sm opacity-25 scale-110"
                  style={{ backgroundImage: `url(${displayImage})` }}
                />
                <div className="relative z-10 w-full max-w-[240px] rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-slate-900">
                  <img src={displayImage} alt={displayTitle} className="w-full h-48 object-cover" />
                  <div className="p-4 bg-gradient-to-t from-slate-950 via-slate-900 to-slate-900/90 text-center">
                    <h3 className="text-sm font-bold text-white leading-snug">{displayTitle}</h3>
                    <p className="text-[11px] text-slate-300 mt-2 line-clamp-3 leading-relaxed">
                      {displayDescription}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Interstitial CTA Bar */}
              <div className="p-4 bg-gradient-to-t from-black via-slate-950/90 to-transparent flex flex-col gap-2 z-40">
                <button
                  type="button"
                  className="w-full py-3 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-500/30"
                >
                  <span>{displayCta}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <span className="text-[9px] text-center text-slate-500">
                  Provided by WebAppyPie Promotion Network
                </span>
              </div>
            </div>
          )}

          {/* Home Indicator */}
          <div className="relative z-40 pb-2 pt-1 flex justify-center">
            <div className="h-1 w-28 rounded-full bg-slate-600" />
          </div>
        </div>
      </div>

      {/* Caption */}
      <div className="mt-3 text-center">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live Mock Preview: {layoutVariant.toUpperCase()}
        </span>
      </div>
    </div>
  );
};
