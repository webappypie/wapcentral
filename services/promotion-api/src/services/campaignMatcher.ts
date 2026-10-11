import type { Campaign, Platform, Environment } from '@wapcentral/types';

import { isVersionInRange } from '../utils/semver.js';

let campaigns: Campaign[] = [];

/**
 * Resets campaigns (seeded only during test harness runs).
 */
export function resetCampaigns(): void {
  if (process.env['NODE_ENV'] === 'test') {
    campaigns = [
      {
        id: 'camp_notes_to_calc',
        name: 'Pie Calc Pro for Engineers',
        promotedAppId: 'app_02',
        targetAppIds: ['app_01', 'test-app'],
        title: 'Unlock Advanced Math & Calculus',
        description: 'Solve matrix transformations and graphs instantly with Pie Calc Pro',
        ctaText: 'Get Free Trial',
        storeUrl: 'https://play.google.com/store/apps/details?id=com.webappypie.calc',
        imageUrl: 'https://storage.googleapis.com/wapcentral/creatives/calc_banner.png',
        layoutVariant: 'banner',
        priority: 85,
        enabled: true,
        status: 'published',
        targetingRules: {
          minAppVersion: '1.0.0',
          platforms: ['android', 'ios'],
          environments: ['production', 'staging', 'development'],
        },
        frequencyCap: {
          maxImpressions: 5,
          periodHours: 24,
        },
        analytics: {
          impressions: 1240,
          clicks: 98,
          ctr: 0.079,
        },
        createdAt: new Date('2026-09-01T00:00:00Z').toISOString(),
        updatedAt: new Date('2026-09-01T00:00:00Z').toISOString(),
      },
    ];
  } else {
    campaigns = [];
  }
}

if (process.env['NODE_ENV'] === 'test') {
  resetCampaigns();
}

export interface MatchParams {
  appId: string;
  version: string;
  env?: Environment | undefined;
  platform?: Platform | undefined;
}

/**
 * Returns all in-memory campaigns.
 */
export function getAllCampaigns(): Campaign[] {
  return [...campaigns];
}

/**
 * Replace entire campaigns array (for tests).
 */
export function setCampaigns(newCampaigns: Campaign[]): void {
  campaigns = [...newCampaigns];
}

/**
 * Evaluates candidate campaigns against targeting criteria and returns the highest priority match.
 */
export function matchCampaign(params: MatchParams): Campaign | null {
  const now = Date.now();

  const candidates = campaigns.filter((camp) => {
    // 1. Status and enabled check
    if (camp.status !== 'published' || !camp.enabled) {
      return false;
    }

    // 2. Target app check
    const matchesTargetApp =
      camp.targetAppIds.includes(params.appId) || camp.targetAppIds.includes('*');
    if (!matchesTargetApp) {
      return false;
    }

    // 3. Schedule window check
    if (camp.scheduleStart) {
      const startTime = new Date(camp.scheduleStart).getTime();
      if (!Number.isNaN(startTime) && now < startTime) {
        return false;
      }
    }
    if (camp.scheduleEnd) {
      const endTime = new Date(camp.scheduleEnd).getTime();
      if (!Number.isNaN(endTime) && now > endTime) {
        return false;
      }
    }

    // 4. Platform targeting check
    if (
      params.platform &&
      camp.targetingRules?.platforms &&
      camp.targetingRules.platforms.length > 0 &&
      !camp.targetingRules.platforms.includes(params.platform)
    ) {
      return false;
    }

    // 5. Environment targeting check
    if (
      params.env &&
      camp.targetingRules?.environments &&
      camp.targetingRules.environments.length > 0 &&
      !camp.targetingRules.environments.includes(params.env)
    ) {
      return false;
    }

    // 6. Semantic version range check
    if (
      params.version &&
      camp.targetingRules &&
      (camp.targetingRules.minAppVersion || camp.targetingRules.maxAppVersion)
    ) {
      const inRange = isVersionInRange(
        params.version,
        camp.targetingRules.minAppVersion,
        camp.targetingRules.maxAppVersion,
      );
      if (!inRange) {
        return false;
      }
    }

    return true;
  });

  if (candidates.length === 0) {
    return null;
  }

  // Sort candidate campaigns by priority descending, then updatedAt descending
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return candidates[0] ?? null;
}
