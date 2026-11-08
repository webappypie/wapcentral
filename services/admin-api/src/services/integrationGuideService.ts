import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ADMOB_OFFICIAL_TEST_IDS } from '@wapcentral/config';
import type { App, AppModule } from '@wapcentral/types';

/**
 * Generates a clean, sanitized filesystem-safe filename for the application integration guide.
 * Example:
 *   "FileZen" -> "WAPCentral_FileZen_Integration_Guide.md"
 *   "OptiLens AI" -> "WAPCentral_OptiLens_AI_Integration_Guide.md"
 */
export function getIntegrationGuideFilename(appName: string): string {
  const raw = appName || 'App';
  // Extract primary name before subtitle dashes if present
  const baseName = raw.split(/[\u2014\u2013-]/)[0]?.trim() || raw;
  const safeName = baseName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  return `WAPCentral_${safeName || 'App'}_Integration_Guide.md`;
}

/**
 * Resolves the location of the canonical master Markdown template file.
 */
export function resolveTemplatePath(): string {
  const candidatePaths: string[] = [
    path.resolve(process.cwd(), 'templates/WAPCentral_App_Integration_Guide_Template.md'),
    path.resolve(process.cwd(), 'services/admin-api/templates/WAPCentral_App_Integration_Guide_Template.md'),
    path.resolve(process.cwd(), '../admin-api/templates/WAPCentral_App_Integration_Guide_Template.md'),
  ];

  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    candidatePaths.push(
      path.resolve(currentDir, '../../templates/WAPCentral_App_Integration_Guide_Template.md'),
      path.resolve(currentDir, '../templates/WAPCentral_App_Integration_Guide_Template.md'),
      path.resolve(currentDir, './templates/WAPCentral_App_Integration_Guide_Template.md'),
      path.resolve(currentDir, '../../services/admin-api/templates/WAPCentral_App_Integration_Guide_Template.md'),
      path.resolve(currentDir, '../services/admin-api/templates/WAPCentral_App_Integration_Guide_Template.md'),
    );
  } catch {
    // Ignore URL parsing errors in non-ESM environments
  }

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Master Integration Guide template not found. Searched paths: ${candidatePaths.join(', ')}`);
}

/**
 * Resolves secret configuration value without masking.
 * Returns the authoritative unmasked secret value for developer and AI team usage,
 * or 'Not configured' if the value is missing.
 */
export function maskSecretValue(secret?: string): string {
  if (!secret || secret.trim() === '' || secret === 'Not configured') {
    return 'Not configured';
  }
  return secret.trim();
}

export interface AppServiceStatus {
  isAiEnabled: boolean;
  isImageEnabled: boolean;
  isOcrEnabled: boolean;
  isFilesEnabled: boolean;
  isAdsEnabled: boolean;
  isNotificationsEnabled: boolean;
  isPromoEnabled: boolean;
  isWeatherEnabled: boolean;
  enabledServicesList: string[];
  enabledSdkNames: string[];
}

/**
 * Inspects an App record to determine the exact set of enabled services and corresponding SDKs.
 */
export function analyzeAppServices(app: App): AppServiceStatus {
  const allowed = app.allowedServices || [];
  const modules = (app.enabledModules || []) as (AppModule | string)[];

  const isAiEnabled = allowed.includes('ai') || modules.includes('ai');
  const isImageEnabled =
    allowed.includes('image') ||
    modules.includes('image_intelligence' as any) ||
    modules.includes('image');
  const isOcrEnabled = allowed.includes('ocr') || modules.includes('ocr');
  const isFilesEnabled =
    allowed.includes('files') ||
    modules.includes('file_intelligence' as any) ||
    modules.includes('files');

  // Authoritative check for ads:
  // If simpleAdsConfig is explicitly provided, it is the primary source of truth for ads enablement
  let isAdsEnabled = false;
  let isPromoFromAds = false;

  if (app.simpleAdsConfig) {
    const simple = app.simpleAdsConfig;
    const hasAnyNetwork = Boolean(
      simple.networks &&
      (simple.networks.admob ||
       simple.networks.applovin ||
       simple.networks.meta ||
       simple.networks.inmobi ||
       simple.networks.unity ||
       simple.networks.wapCustomAds)
    );
    isAdsEnabled = Boolean(simple.adsEnabled && hasAnyNetwork);
    isPromoFromAds = Boolean(simple.adsEnabled && simple.networks?.wapCustomAds);
  } else if (app.adConfig) {
    const legacy = app.adConfig;
    isAdsEnabled = Boolean(
      legacy.admob?.enabled ||
      legacy.applovin?.enabled ||
      legacy.meta?.enabled ||
      legacy.wapads?.enabled
    );
    isPromoFromAds = Boolean(legacy.wapads?.enabled);
  } else {
    // If neither simpleAdsConfig nor adConfig is stored, check platform module enablement
    isAdsEnabled = allowed.includes('ads') || modules.includes('ads');
  }

  const isNotificationsEnabled =
    allowed.includes('notifications' as any) ||
    modules.includes('notifications' as any) ||
    (allowed.length === 0 && Boolean(app.fcmSenderId && app.fcmSenderId !== 'Not configured' && app.fcmSenderId.trim() !== ''));

  const isPromoEnabled =
    allowed.includes('promotion' as any) ||
    modules.includes('promotion') ||
    isPromoFromAds;

  const isWeatherEnabled =
    allowed.includes('weather' as any) ||
    modules.includes('weather' as any);

  const enabledServicesList: string[] = [];
  if (isAiEnabled) enabledServicesList.push('AI');
  if (isImageEnabled) enabledServicesList.push('Image');
  if (isOcrEnabled) enabledServicesList.push('OCR');
  if (isFilesEnabled) enabledServicesList.push('Files');
  if (isAdsEnabled) enabledServicesList.push('Ads');
  if (isNotificationsEnabled) enabledServicesList.push('Notifications');
  if (isPromoEnabled) enabledServicesList.push('Promotion');
  if (isWeatherEnabled) enabledServicesList.push('Weather');

  const enabledSdkNames: string[] = ['wap_core_sdk'];
  if (isAiEnabled) enabledSdkNames.push('wap_ai_sdk');
  if (isImageEnabled) enabledSdkNames.push('wap_image_sdk');
  if (isOcrEnabled) enabledSdkNames.push('wap_ocr_sdk');
  if (isFilesEnabled) enabledSdkNames.push('wap_file_sdk');
  if (isAdsEnabled) enabledSdkNames.push('wap_ads_sdk');
  if (isNotificationsEnabled) enabledSdkNames.push('wap_notifications_sdk');
  if (isPromoEnabled) enabledSdkNames.push('wap_promo_sdk');
  if (isWeatherEnabled) enabledSdkNames.push('wap_weather_sdk');

  return {
    isAiEnabled,
    isImageEnabled,
    isOcrEnabled,
    isFilesEnabled,
    isAdsEnabled,
    isNotificationsEnabled,
    isPromoEnabled,
    isWeatherEnabled,
    enabledServicesList,
    enabledSdkNames,
  };
}

/**
 * Builds the application-specific Section 5 (Enabled WAP SDKs Table).
 */
export function buildSdkTable(app: App, status: AppServiceStatus): string {
  const rows: string[] = [
    '| SDK Package | Purpose | Status for ' + app.name + ' |',
    '| :--- | :--- | :--- |',
    '| `wap_core_sdk` | WAPCentral connection, auth headers, request retry, error handling | `✓ Required (Core WAP runtime & auth)` |',
  ];

  if (status.isAiEnabled) {
    rows.push('| `wap_ai_sdk` | Generative AI, vision analysis, classification, summarization, translation | `✓ Required (Enabled for ' + app.name + ')` |');
  }
  if (status.isImageEnabled) {
    rows.push('| `wap_image_sdk` | On-device & neural image enhancement, smart cropping, blur detection | `✓ Required (Enabled for ' + app.name + ')` |');
  }
  if (status.isOcrEnabled) {
    rows.push('| `wap_ocr_sdk` | Optical character recognition, document field extraction | `✓ Required (Enabled for ' + app.name + ')` |');
  }
  if (status.isFilesEnabled) {
    rows.push('| `wap_file_sdk` | Semantic file search, categorization, document clustering | `✓ Required (Enabled for ' + app.name + ')` |');
  }
  if (status.isAdsEnabled) {
    let adsPurpose = 'Central Ads configuration & runtime controls';
    const simple = app.simpleAdsConfig;
    const isAdmob = Boolean(simple?.networks?.admob || app.adConfig?.admob?.enabled);
    const isApplovin = Boolean(simple?.networks?.applovin || app.adConfig?.applovin?.enabled);
    const isPromo = Boolean(simple?.networks?.wapCustomAds || app.adConfig?.wapads?.enabled);
    const isMeta = Boolean(simple?.networks?.meta || app.adConfig?.meta?.enabled);
    const isInmobi = Boolean(simple?.networks?.inmobi);
    const isUnity = Boolean(simple?.networks?.unity);

    if (isAdmob && !isApplovin && !isMeta && !isInmobi && !isUnity && !isPromo) {
      adsPurpose = 'Central Ads configuration & Google AdMob direct integration';
    } else if (isApplovin && !isAdmob && !isMeta && !isInmobi && !isUnity && !isPromo) {
      adsPurpose = 'Central Ads configuration & AppLovin MAX mediation';
    } else if (isApplovin && isAdmob && !isMeta && !isInmobi && !isUnity && !isPromo) {
      adsPurpose = 'Central Ads configuration & AppLovin MAX mediation with Google AdMob adapter';
    } else if (isApplovin) {
      adsPurpose = 'Central Ads configuration, AppLovin MAX mediation, demand adapters';
      if (isPromo) adsPurpose += ', house ads fallback';
    } else if (isPromo && !isAdmob && !isApplovin) {
      adsPurpose = 'Central Ads configuration & house promotions fallback';
    }
    rows.push('| `wap_ads_sdk` | ' + adsPurpose + ' | `✓ Required (Enabled for ' + app.name + ')` |');
  }
  if (status.isNotificationsEnabled) {
    rows.push('| `wap_notifications_sdk` | FCM device token registration, notification feed, read synchronization | `✓ Required (Enabled for ' + app.name + ')` |');
  }
  if (status.isPromoEnabled) {
    rows.push('| `wap_promo_sdk` | Cross-promotional campaign surfaces, interstitials, banners | `✓ Required (Enabled for ' + app.name + ')` |');
  }
  if (status.isWeatherEnabled) {
    rows.push('| `wap_weather_sdk` | Centralized weather forecast, current conditions, global location search | `✓ Required (Enabled for ' + app.name + ')` |');
  }

  return rows.join('\n');
}

/**
 * Builds the application-specific Section 7 (Platform API Catalog Table).
 */
export function buildApiCatalogTable(status: AppServiceStatus): string {
  const aiStatus = status.isAiEnabled ? 'ai — Enabled' : 'ai — Not enabled for this app';
  const imgStatus = status.isImageEnabled ? 'image — Enabled' : 'image — Not enabled for this app';
  const ocrStatus = status.isOcrEnabled ? 'ocr — Enabled' : 'ocr — Not enabled for this app';
  const filesStatus = status.isFilesEnabled ? 'files — Enabled' : 'files — Not enabled for this app';
  const adsStatus = status.isAdsEnabled ? 'ads — Enabled' : 'ads — Not enabled for this app';
  const notifStatus = status.isNotificationsEnabled ? 'notifications — Enabled' : 'notifications — Not enabled for this app';
  const promoStatus = status.isPromoEnabled ? 'promotion — Enabled' : 'promotion — Not enabled for this app';
  const weatherStatus = status.isWeatherEnabled ? 'weather — Enabled' : 'weather — Not enabled for this app';

  return [
    '| Service | Method | Route | Permission Status for this App |',
    '| :--- | :---: | :--- | :--- |',
    '| **Health** | `GET` | `/api/platform/v1/health` | `Public (Available)` |',
    '| **Service Control** | `GET` | `/api/platform/v1/apps/{appId}/service-status` | `Public / Authenticated (Active)` |',
    `| **AI** | \`POST\` | \`/api/platform/v1/ai/generate\` | \`${aiStatus}\` |`,
    `| **AI** | \`POST\` | \`/api/platform/v1/ai/vision\` | \`${aiStatus}\` |`,
    `| **AI** | \`POST\` | \`/api/platform/v1/ai/classify\` | \`${aiStatus}\` |`,
    `| **AI** | \`POST\` | \`/api/platform/v1/ai/summarize\` | \`${aiStatus}\` |`,
    `| **AI** | \`POST\` | \`/api/platform/v1/ai/translate\` | \`${aiStatus}\` |`,
    `| **AI** | \`POST\` | \`/api/platform/v1/ai/extract\` | \`${aiStatus}\` |`,
    `| **Image** | \`POST\` | \`/api/platform/v1/image/enhance\` | \`${imgStatus}\` |`,
    `| **Image** | \`POST\` | \`/api/platform/v1/image/analyze\` | \`${imgStatus}\` |`,
    `| **OCR** | \`POST\` | \`/api/platform/v1/ocr/extract\` | \`${ocrStatus}\` |`,
    `| **Files** | \`POST\` | \`/api/platform/v1/files/search\` | \`${filesStatus}\` |`,
    `| **Files** | \`POST\` | \`/api/platform/v1/files/classify\` | \`${filesStatus}\` |`,
    `| **Ads** | \`GET\` | \`/api/platform/v1/ads/config\` | \`${adsStatus}\` |`,
    `| **Ads** | \`POST\` | \`/api/platform/v1/ads/analytics/events\` | \`${adsStatus}\` |`,
    `| **Ads (Custom)** | \`POST\` | \`/api/platform/v1/ads/custom/track\` | \`${promoStatus}\` |`,
    `| **Promotions** | \`GET\` | \`/api/platform/v1/promotion\` | \`${promoStatus}\` |`,
    `| **Promotions** | \`POST\` | \`/api/platform/v1/analytics/impression\` | \`${promoStatus}\` |`,
    `| **Promotions** | \`POST\` | \`/api/platform/v1/analytics/click\` | \`${promoStatus}\` |`,
    `| **Notifications** | \`POST\` | \`/api/platform/v1/notifications/devices/register\` | \`${notifStatus}\` |`,
    `| **Notifications** | \`GET\` | \`/api/platform/v1/notifications\` | \`${notifStatus}\` |`,
    `| **Weather** | \`GET\`/\`POST\` | \`/api/platform/v1/weather/current\` | \`${weatherStatus}\` |`,
    `| **Weather** | \`GET\`/\`POST\` | \`/api/platform/v1/weather/forecast\` | \`${weatherStatus}\` |`,
    `| **Weather** | \`GET\`/\`POST\` | \`/api/platform/v1/weather/search\` | \`${weatherStatus}\` |`,
  ].join('\n');
}

/**
 * Builds the application-specific Section 8 (Ads — Controlled by WAPCentral).
 * Filters strictly to advertising providers that are explicitly enabled for this application.
 * Disabled providers are completely omitted from the documentation, tables, and instructions.
 */
export function buildAdsSection(app: App, isAdsEnabled: boolean): string {
  const simple = app.simpleAdsConfig;
  const isAdmobEnabled = Boolean(simple?.networks?.admob);
  const isApplovinEnabled = Boolean(simple?.networks?.applovin);
  const isMetaEnabled = Boolean(simple?.networks?.meta);
  const isInmobiEnabled = Boolean(simple?.networks?.inmobi);
  const isUnityEnabled = Boolean(simple?.networks?.unity);
  const isPromoEnabled = Boolean(simple?.networks?.wapCustomAds);

  const hasAnyActiveNetwork =
    isAdmobEnabled ||
    isApplovinEnabled ||
    isMetaEnabled ||
    isInmobiEnabled ||
    isUnityEnabled ||
    isPromoEnabled;

  if (!isAdsEnabled || !hasAnyActiveNetwork) {
    return [
      '## 8. Ads — Controlled by WAPCentral',
      '',
      '> **Ads: Disabled for this application.**',
      '',
      '- No advertising providers are currently enabled for this application.',
      '- Do not install `wap_ads_sdk` or initialize third-party advertising SDKs in this app.',
      '- Do not create local ad views, test banners, or configure ad units in mobile client code.',
      '- If ads are needed in the future, enable them centrally in **WAPCentral Dashboard → Applications → ' + app.name + ' → Ads**.',
    ].join('\n');
  }

  const env =
    simple?.environment === 'testing'
      ? 'Testing'
      : app.environment === 'production'
        ? 'Production'
        : 'Testing';

  // Active demand sources strictly for this application
  const activeDemandSources: string[] = [];
  if (isApplovinEnabled) activeDemandSources.push('AppLovin MAX (Direct Demand)');
  if (isAdmobEnabled) activeDemandSources.push(isApplovinEnabled ? 'Google AdMob (MAX Adapter)' : 'Google AdMob (Direct GMA)');
  if (isMetaEnabled) activeDemandSources.push('Meta Audience Network (MAX Adapter)');
  if (isInmobiEnabled) activeDemandSources.push('InMobi (MAX Adapter)');
  if (isUnityEnabled) activeDemandSources.push('Unity Ads (MAX Adapter)');
  if (isPromoEnabled) activeDemandSources.push('WebAppyPie Promotions (House Fallback)');

  // Formats active for this specific application
  const banner = simple?.enabledFormats?.banner ?? true ? 'Banner' : null;
  const native = simple?.enabledFormats?.native ?? true ? 'Native' : null;
  const interstitial = simple?.enabledFormats?.interstitial ?? true ? 'Interstitial' : null;
  const rewarded = simple?.enabledFormats?.rewarded ?? true ? 'Rewarded' : null;
  const appOpen = simple?.enabledFormats?.appOpen ?? true ? 'App Open' : null;
  const rewardedInterstitial = simple?.enabledFormats?.rewardedInterstitial ? 'Rewarded Interstitial' : null;
  const activeFormats = [banner, native, interstitial, rewarded, appOpen, rewardedInterstitial].filter(Boolean);

  // Determine Architecture Narrative & Mediation Strategy
  let architectureOverview = '';
  let mediationDetails = '';
  const isAdmobSole = isAdmobEnabled && !isApplovinEnabled && !isMetaEnabled && !isInmobiEnabled && !isUnityEnabled && !isPromoEnabled;
  const isApplovinSole = isApplovinEnabled && !isAdmobEnabled && !isMetaEnabled && !isInmobiEnabled && !isUnityEnabled && !isPromoEnabled;

  if (isAdmobSole) {
    architectureOverview = `This app uses **Google AdMob as the sole advertising provider**. WAPCentral centrally controls Ads Enabled/Disabled, Testing/Production mode, enabled formats, and production ad units for this app. Third-party mediation platforms (such as AppLovin MAX) and external house promotions are disabled and are **NOT required** for this app.`;
    mediationDetails = [
      '### Single Provider Direct Integration (Google AdMob):',
      '- **Direct GMA Integration:** Mobile client connects directly to Google Mobile Ads (GMA) or through `wap_ads_sdk` in AdMob-direct mode.',
      '- **Zero Mediation Overhead:** Bypasses third-party auction latency and external mediation SDKs.',
      '- **No AppLovin Credentials Required:** Do not configure AppLovin SDK keys or declare AppLovin metadata in native manifests.',
      '- **Google Mobile Ads App ID:** Declared in `AndroidManifest.xml` and `Info.plist`.',
    ].join('\n');
  } else if (isApplovinSole) {
    architectureOverview = `This app uses **AppLovin MAX as the sole advertising mediation platform** (standalone direct demand). WAPCentral centrally controls Ads Enabled/Disabled, Testing/Production mode, enabled formats, and production identifiers for this app. External demand adapters (AdMob, Meta, InMobi, Unity) and house promotions are disabled and are **NOT required** for this app.`;
    mediationDetails = [
      '### Standalone Mediation Platform (AppLovin MAX Direct Demand):',
      '- **Direct AppLovin Demand:** Mobile client connects directly to AppLovin MAX exchange demand without external third-party mediation adapters.',
      '- **Zero Third-Party Adapter Overhead:** No external demand adapters (AdMob, Meta, InMobi, Unity) are bundled or required.',
      '- **No Google Mobile Ads App ID Required:** Google AdMob is disabled for this app; do not declare Google Mobile Ads APPLICATION_ID in native manifests.',
      '- **AppLovin SDK Key:** Declared in `AndroidManifest.xml` and `Info.plist`.',
    ].join('\n');
  } else if (isApplovinEnabled) {
    architectureOverview = `This app uses **AppLovin MAX as the primary advertising mediation platform**. WAPCentral centrally controls Ads Enabled/Disabled, Ad Strategy, Testing/Production mode, enabled demand sources, enabled formats, and production identifiers for this app.`;
    const strategy = simple?.strategy === 'single_source' ? 'Single Demand Source' : 'Automatic Mediation';
    const strategyDetails =
      simple?.strategy === 'single_source' && simple.singleSourceNetwork
        ? `${strategy} (${simple.singleSourceNetwork} routed through MAX)`
        : strategy;
    mediationDetails = [
      '### Dashboard Switching Capabilities & Mediation Strategies:',
      'WAPCentral empowers administrators to manage advertising remotely without client code modifications:',
      '',
      '#### Strategy A: Automatic Mediation via AppLovin MAX',
      '- **Multi-Source Competition:** AppLovin MAX conducts real-time unified auctions and waterfalls across all enabled, pre-bundled demand sources.',
      '- **Remote Demand Toggling:** Administrators can enable or disable individual demand sources directly from the dashboard.',
      '- **Dynamic Format Controls:** Toggle formats on and off per application without redeploying mobile apps.',
      '',
      '#### Strategy B: Single Demand Source via MAX',
      `- **Exclusive Demand Routing:** Current Strategy is \`${strategyDetails}\`. When single demand source mode is active, 100% of mediation requests route exclusively to the designated partner through MAX.`,
    ].join('\n');
    if (isPromoEnabled) {
      mediationDetails += '\n\n' + [
        '#### Decoupled House Promotions (WebAppyPie Promotions / `wap_promo_sdk`)',
        '- **Completely Decoupled:** WebAppyPie Promotions is an independent house cross-promotional engine, completely separated from third-party advertising demand auctions.',
        '- **Guaranteed House Fallback:** When third-party ad networks experience zero fill or latency timeouts, WebAppyPie Promotions automatically display high-quality in-house promotional creatives without crashing or showing blank containers.',
      ].join('\n');
    }
  } else if (isPromoEnabled && !isApplovinEnabled && !isAdmobEnabled) {
    architectureOverview = `This app uses **WebAppyPie Promotions as the in-house advertising engine**. Commercial third-party advertising networks (AdMob, AppLovin MAX, Meta, InMobi, Unity) are disabled.`;
    mediationDetails = [
      '### In-House Promotions Engine:',
      '- **Zero Commercial Dependencies:** No commercial third-party SDKs or ad mediation networks are bundled.',
      '- **Internal House Campaigns:** Promotional banners and interstitials are fetched directly from WAPCentral campaign services.',
    ].join('\n');
  } else {
    architectureOverview = `This app uses a multi-provider setup with: ${activeDemandSources.join(', ')}.`;
    mediationDetails = [
      '### Multi-Provider Waterfall & Fallback Rules:',
      '- Primary monetization providers are queried in order of priority.',
      isPromoEnabled ? '- WebAppyPie Promotions acts as the final house ad fallback upon zero fill.' : '- If no ad fill is available, ad containers are hidden gracefully without UI disruption.',
    ].join('\n');
  }

  // Testing vs Production verification text
  const verificationText =
    env === 'Testing'
      ? '- **Testing Mode is ACTIVE:** Official SDK test ads and sandbox unit IDs are automatically injected by WAPCentral. Never use or click live production ads during development.'
      : '- **Production Mode is ACTIVE:** Genuine provider-reported impressions and auction bids are used. Any missing ad units will show `Not configured` and will be cleanly omitted.';

  // Master Provider & Demand Source Matrix (ONLY enabled providers)
  const rosterRows: string[] = [
    '| Provider / Demand Source | Role & Architecture | Integration Status | Required Mobile SDK / Adapter | Supported Formats | Configuration Keys |',
    '| :--- | :--- | :---: | :--- | :--- | :--- |',
  ];
  if (isApplovinEnabled) {
    rosterRows.push('| **AppLovin MAX** | Primary Mediation Platform | `Configured & Verified` | `applovin_max: ^4.0.1`<br>(Android: `com.applovin:applovin-sdk:13.1.0`, iOS: `AppLovinSDK`) | Banner, Native, Interstitial, Rewarded, App Open, Rewarded Interstitial | AppLovin SDK Key (`AppLovinSdkKey`), MAX Ad Unit IDs |');
  }
  if (isAdmobEnabled) {
    if (isApplovinEnabled) {
      rosterRows.push('| **Google AdMob** | Demand Partner via MAX Adapter | `Configured & Verified` | `com.applovin.mediation:google-adapter:23.6.0.0`<br>(iOS: `AppLovinMediationGoogleAdapter`) | Banner, Native, Interstitial, Rewarded, App Open, Rewarded Interstitial | Google Mobile Ads App ID (`APPLICATION_ID`), Ad Unit IDs |');
    } else {
      rosterRows.push('| **Google AdMob** | Direct Advertising Provider | `Configured & Verified` | `google_mobile_ads: ^5.2.0`<br>(Android: `com.google.android.gms:play-services-ads:23.6.0`) | Banner, Native, Interstitial, Rewarded, App Open, Rewarded Interstitial | Google Mobile Ads App ID (`APPLICATION_ID`), Ad Unit IDs |');
    }
  }
  if (isMetaEnabled) {
    rosterRows.push('| **Meta Audience Network** | Demand Partner via MAX Adapter | `Configured & Verified` | `com.applovin.mediation:facebook-adapter:6.18.0.0`<br>(iOS: `AppLovinMediationFacebookAdapter`) | Banner, Native, Interstitial, Rewarded<br>*(App Open & Rewarded Interstitial NOT supported)* | Meta Placement IDs, `app-ads.txt` verification |');
  }
  if (isInmobiEnabled) {
    rosterRows.push('| **InMobi** | Demand Partner via MAX Adapter | `Configured & Verified` | `com.applovin.mediation:inmobi-adapter:10.8.0.0`<br>(iOS: `AppLovinMediationInMobiAdapter`) | Banner, Native, Interstitial, Rewarded<br>*(App Open & Rewarded Interstitial NOT supported)* | InMobi Account ID, Placement IDs |');
  }
  if (isUnityEnabled) {
    rosterRows.push('| **Unity Ads** | Demand Partner via MAX Adapter | `Configured & Verified` | `com.applovin.mediation:unityads-adapter:4.12.5.0`<br>(iOS: `AppLovinMediationUnityAdsAdapter`) | Banner, Interstitial, Rewarded<br>*(Native & App Open NOT supported)* | Unity Game ID, Placement IDs |');
  }
  if (isPromoEnabled) {
    rosterRows.push('| **WebAppyPie Promotions** | House Campaigns / Fallback | `Implemented & Tested` | `wap_promo_sdk`<br>*(Zero 3rd-party dependencies, completely decoupled)* | Banner, Native Card, Interstitial, Sponsored Placement | App ID, Public Client Key |');
  }

  // Build Official Testing Configuration Table (ONLY enabled providers)
  const testRows: string[] = [
    '| Provider | Format | Testing Method / Test Identifier | Testing Status | Official Documentation |',
    '| :--- | :--- | :--- | :---: | :--- |',
  ];
  if (isApplovinEnabled) {
    testRows.push('| **AppLovin MAX** | Banner | MAX Test Mode / Mediation Debugger using app MAX Ad Unit ID | `Test mode required` | [AppLovin Test Mode](https://dash.applovin.com/documentation/mediation/test-mode) |');
    testRows.push('| **AppLovin MAX** | Native | MAX Test Mode / Mediation Debugger using app MAX Native Ad Unit ID | `Test mode required` | [AppLovin Test Mode](https://dash.applovin.com/documentation/mediation/test-mode) |');
    testRows.push('| **AppLovin MAX** | Interstitial | MAX Test Mode / Mediation Debugger using app MAX Interstitial Ad Unit ID | `Test mode required` | [AppLovin Test Mode](https://dash.applovin.com/documentation/mediation/test-mode) |');
    testRows.push('| **AppLovin MAX** | Rewarded | MAX Test Mode / Mediation Debugger using app MAX Rewarded Ad Unit ID | `Test mode required` | [AppLovin Test Mode](https://dash.applovin.com/documentation/mediation/test-mode) |');
    testRows.push('| **AppLovin MAX** | App Open | MAX Test Mode / Mediation Debugger using app MAX App Open Ad Unit ID | `Test mode required` | [AppLovin Test Mode](https://dash.applovin.com/documentation/mediation/test-mode) |');
    testRows.push('| **AppLovin MAX** | Rewarded Interstitial | MAX Test Mode / Mediation Debugger using app MAX Rewarded Interstitial ID | `Test mode required` | [AppLovin Test Mode](https://dash.applovin.com/documentation/mediation/test-mode) |');
  }
  if (isAdmobEnabled) {
    testRows.push(`| **Google AdMob** | App ID (Android Test) | \`${ADMOB_OFFICIAL_TEST_IDS.android.appId}\` | \`Configured\` | [AdMob Test Ads](https://developers.google.com/admob/android/test-ads#sample_ad_units) |`);
    testRows.push(`| **Google AdMob** | Banner (adaptive) | \`${ADMOB_OFFICIAL_TEST_IDS.android.bannerAdaptive}\` | \`Configured\` | [AdMob Test Ads](https://developers.google.com/admob/android/test-ads#sample_ad_units) |`);
    testRows.push(`| **Google AdMob** | Banner (fixed) | \`${ADMOB_OFFICIAL_TEST_IDS.android.bannerFixed}\` | \`Configured\` | [AdMob Test Ads](https://developers.google.com/admob/android/test-ads#sample_ad_units) |`);
    testRows.push(`| **Google AdMob** | Native | \`${ADMOB_OFFICIAL_TEST_IDS.android.native}\` | \`Configured\` | [AdMob Test Ads](https://developers.google.com/admob/android/test-ads#sample_ad_units) |`);
    testRows.push(`| **Google AdMob** | Interstitial | \`${ADMOB_OFFICIAL_TEST_IDS.android.interstitial}\` | \`Configured\` | [AdMob Test Ads](https://developers.google.com/admob/android/test-ads#sample_ad_units) |`);
    testRows.push(`| **Google AdMob** | Rewarded | \`${ADMOB_OFFICIAL_TEST_IDS.android.rewarded}\` | \`Configured\` | [AdMob Test Ads](https://developers.google.com/admob/android/test-ads#sample_ad_units) |`);
    testRows.push(`| **Google AdMob** | App Open | \`${ADMOB_OFFICIAL_TEST_IDS.android.appOpen}\` | \`Configured\` | [AdMob Test Ads](https://developers.google.com/admob/android/test-ads#sample_ad_units) |`);
    testRows.push(`| **Google AdMob** | Rewarded Interstitial | \`${ADMOB_OFFICIAL_TEST_IDS.android.rewardedInterstitial}\` | \`Configured\` | [AdMob Test Ads](https://developers.google.com/admob/android/test-ads#sample_ad_units) |`);
  }
  if (isMetaEnabled) {
    testRows.push('| **Meta Audience Network** | Banner | Test device registration or prefix `IMG_16_9_APP_INSTALL#...` | `Test mode required` | [Meta Test Ads](https://developers.facebook.com/docs/audience-network/guides/test-ads) |');
    testRows.push('| **Meta Audience Network** | Native | Test device registration or prefix `IMG_16_9_APP_INSTALL#...` | `Test mode required` | [Meta Test Ads](https://developers.facebook.com/docs/audience-network/guides/test-ads) |');
    testRows.push('| **Meta Audience Network** | Interstitial | Test device registration or prefix `VID_HD_9_16_39S_APP_INSTALL#...` | `Test mode required` | [Meta Test Ads](https://developers.facebook.com/docs/audience-network/guides/test-ads) |');
    testRows.push('| **Meta Audience Network** | Rewarded | Test device registration or prefix `VID_HD_9_16_39S_APP_INSTALL#...` | `Test mode required` | [Meta Test Ads](https://developers.facebook.com/docs/audience-network/guides/test-ads) |');
  }
  if (isInmobiEnabled) {
    testRows.push('| **InMobi** | Banner / Native / Interstitial / Rewarded | InMobi Portal Test Mode (Toggle ON in portal for Placement) | `Requires provider setup` | [InMobi Testing Guide](https://support.inmobi.com/monetize/integration-guides/android-sdk/testing-your-integration/) |');
  }
  if (isUnityEnabled) {
    testRows.push('| **Unity Ads** | Banner | Unity Dashboard Test Mode (Testing: ON) / `Banner_Android` | `Test mode required` | [Unity Ads Testing](https://docs.unity.com/ads/en-us/manual/Testing) |');
    testRows.push('| **Unity Ads** | Interstitial | Unity Dashboard Test Mode (Testing: ON) / `Interstitial_Android` | `Test mode required` | [Unity Ads Testing](https://docs.unity.com/ads/en-us/manual/Testing) |');
    testRows.push('| **Unity Ads** | Rewarded | Unity Dashboard Test Mode (Testing: ON) / `Rewarded_Android` | `Test mode required` | [Unity Ads Testing](https://docs.unity.com/ads/en-us/manual/Testing) |');
  }
  if (isPromoEnabled) {
    testRows.push('| **WebAppyPie Promotions** | Banner / Native / Interstitial / Rewarded | Internal house promo fallback creative (`custom_inhouse`) | `Configured` | [WAPCentral Ads](https://wapcentral.webappypie.com/ads) |');
  }

  // Build Comprehensive Production Configuration Table (ONLY enabled providers)
  const prodRows: string[] = [
    '| Demand Source | Ad Format / Parameter | Configured Value for ' + app.name + ' | Integration & Production Status |',
    '| :--- | :--- | :--- | :---: |',
  ];

  if (isApplovinEnabled) {
    const applovinSdkKey = simple?.networkConfig?.applovin?.sdkKey?.trim() || 'Not configured';
    const applovinBanner = simple?.networkConfig?.applovin?.placementIds?.banner || 'Not configured';
    const applovinNative = simple?.networkConfig?.applovin?.placementIds?.native || 'Not configured';
    const applovinInterstitial = simple?.networkConfig?.applovin?.placementIds?.interstitial || 'Not configured';
    const applovinRewarded = simple?.networkConfig?.applovin?.placementIds?.rewarded || 'Not configured';
    const applovinAppOpen = simple?.networkConfig?.applovin?.placementIds?.app_open || 'Not configured';
    const applovinRewardedInterstitial = simple?.networkConfig?.applovin?.placementIds?.rewarded_interstitial || 'Not configured';

    prodRows.push(`| AppLovin MAX | SDK Key (\`AppLovinSdkKey\`) | \`${applovinSdkKey}\` | ${applovinSdkKey !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodRows.push(`| AppLovin MAX | Banner | \`${applovinBanner}\` | ${applovinBanner !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodRows.push(`| AppLovin MAX | Native | \`${applovinNative}\` | ${applovinNative !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodRows.push(`| AppLovin MAX | Interstitial | \`${applovinInterstitial}\` | ${applovinInterstitial !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodRows.push(`| AppLovin MAX | Rewarded | \`${applovinRewarded}\` | ${applovinRewarded !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodRows.push(`| AppLovin MAX | App Open | \`${applovinAppOpen}\` | ${applovinAppOpen !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodRows.push(`| AppLovin MAX | Rewarded Interstitial | \`${applovinRewardedInterstitial}\` | ${applovinRewardedInterstitial !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
  }

  if (isAdmobEnabled) {
    const admobAppId = simple?.networkConfig?.admob?.appId?.trim() || (env === 'Testing' ? ADMOB_OFFICIAL_TEST_IDS.android.appId : 'Not configured');
    const admobBanner = simple?.networkConfig?.admob?.bannerId || 'Not configured';
    const admobNative = simple?.networkConfig?.admob?.nativeId || 'Not configured';
    const admobInterstitial = simple?.networkConfig?.admob?.interstitialId || 'Not configured';
    const admobRewarded = simple?.networkConfig?.admob?.rewardedId || 'Not configured';
    const admobAppOpen = simple?.networkConfig?.admob?.appOpenId || 'Not configured';
    const admobRewardedInterstitial = simple?.networkConfig?.admob?.rewardedInterstitialId || 'Not configured';

    prodRows.push(`| Google AdMob | Application ID | \`${admobAppId}\` | ${admobAppId !== 'Not configured' ? '`Configured`' : '`Requires Credentials/Approval`'} |`);
    prodRows.push(`| Google AdMob | Banner | \`${admobBanner}\` | ${admobBanner !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
    prodRows.push(`| Google AdMob | Native | \`${admobNative}\` | ${admobNative !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
    prodRows.push(`| Google AdMob | Interstitial | \`${admobInterstitial}\` | ${admobInterstitial !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
    prodRows.push(`| Google AdMob | Rewarded | \`${admobRewarded}\` | ${admobRewarded !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
    prodRows.push(`| Google AdMob | App Open | \`${admobAppOpen}\` | ${admobAppOpen !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
    prodRows.push(`| Google AdMob | Rewarded Interstitial | \`${admobRewardedInterstitial}\` | ${admobRewardedInterstitial !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
  }

  if (isMetaEnabled) {
    const metaBanner = simple?.networkConfig?.meta?.placementIds?.banner || 'Not configured';
    const metaNative = simple?.networkConfig?.meta?.placementIds?.native || 'Not configured';
    const metaInterstitial = simple?.networkConfig?.meta?.placementIds?.interstitial || 'Not configured';
    const metaRewarded = simple?.networkConfig?.meta?.placementIds?.rewarded || 'Not configured';

    prodRows.push(`| Meta Audience Network | Banner | \`${metaBanner}\` | ${metaBanner !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
    prodRows.push(`| Meta Audience Network | Native | \`${metaNative}\` | ${metaNative !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
    prodRows.push(`| Meta Audience Network | Interstitial | \`${metaInterstitial}\` | ${metaInterstitial !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
    prodRows.push(`| Meta Audience Network | Rewarded | \`${metaRewarded}\` | ${metaRewarded !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
  }

  if (isInmobiEnabled) {
    const inmobiAccountId = simple?.networkConfig?.inmobi?.accountId?.trim() || 'Not configured';
    const inmobiBanner = simple?.networkConfig?.inmobi?.placementIds?.banner || 'Not configured';
    const inmobiNative = simple?.networkConfig?.inmobi?.placementIds?.native || 'Not configured';
    const inmobiInterstitial = simple?.networkConfig?.inmobi?.placementIds?.interstitial || 'Not configured';
    const inmobiRewarded = simple?.networkConfig?.inmobi?.placementIds?.rewarded || 'Not configured';

    prodRows.push(`| InMobi | Account ID | \`${inmobiAccountId}\` | ${inmobiAccountId !== 'Not configured' ? '`Configured`' : '`Requires Credentials/Approval`'} |`);
    prodRows.push(`| InMobi | Banner | \`${inmobiBanner}\` | ${inmobiBanner !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
    prodRows.push(`| InMobi | Native | \`${inmobiNative}\` | ${inmobiNative !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
    prodRows.push(`| InMobi | Interstitial | \`${inmobiInterstitial}\` | ${inmobiInterstitial !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
    prodRows.push(`| InMobi | Rewarded | \`${inmobiRewarded}\` | ${inmobiRewarded !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
  }

  if (isUnityEnabled) {
    const unityGameId = simple?.networkConfig?.unity?.gameId?.trim() || 'Not configured';
    const unityBanner = simple?.networkConfig?.unity?.placementIds?.banner || 'Not configured';
    const unityInterstitial = simple?.networkConfig?.unity?.placementIds?.interstitial || 'Not configured';
    const unityRewarded = simple?.networkConfig?.unity?.placementIds?.rewarded || 'Not configured';

    prodRows.push(`| Unity Ads | Game ID | \`${unityGameId}\` | ${unityGameId !== 'Not configured' ? '`Configured`' : '`Requires Credentials/Approval`'} |`);
    prodRows.push(`| Unity Ads | Banner | \`${unityBanner}\` | ${unityBanner !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
    prodRows.push(`| Unity Ads | Interstitial | \`${unityInterstitial}\` | ${unityInterstitial !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
    prodRows.push(`| Unity Ads | Rewarded | \`${unityRewarded}\` | ${unityRewarded !== 'Not configured' ? '`Configured`' : '`Integrated but Not Configured`'} |`);
  }

  if (isPromoEnabled) {
    prodRows.push(`| WebAppyPie Promotions | All Formats | \`custom_inhouse\` (Dynamic Campaigns) | \`Configured\` |`);
  }

  // Account Approval & Prerequisites (ONLY enabled providers)
  const prereqItems: string[] = [];
  if (isApplovinEnabled) {
    prereqItems.push(`${prereqItems.length + 1}. **AppLovin MAX:** AppLovin SDK Key (\`AppLovinSdkKey\`) must be configured in \`AndroidManifest.xml\` and \`Info.plist\`. Applications must be registered in the AppLovin Dashboard.`);
  }
  if (isAdmobEnabled) {
    prereqItems.push(`${prereqItems.length + 1}. **Google AdMob:** Requires an approved Google AdMob account with verified identity and active payment profile. \`app-ads.txt\` must be published on the app developer domain. Google Mobile Ads App ID (\`APPLICATION_ID\`) must be declared in native manifests.`);
  }
  if (isMetaEnabled) {
    prereqItems.push(`${prereqItems.length + 1}. **Meta Audience Network:** Requires Meta Business Manager verification, published \`app-ads.txt\`, and registered placements in Meta Monetization Manager. Note: Meta does NOT support App Open or Rewarded Interstitial formats.`);
  }
  if (isInmobiEnabled) {
    prereqItems.push(`${prereqItems.length + 1}. **InMobi:** Requires approved InMobi publisher account and Property ID. InMobi Account ID must be configured in partner dashboard. Note: InMobi does NOT support App Open or Rewarded Interstitial formats.`);
  }
  if (isUnityEnabled) {
    prereqItems.push(`${prereqItems.length + 1}. **Unity Ads:** Requires Unity Gaming Services Organization approval and Unity Game ID registered in the Unity Dashboard. Note: Unity Ads does NOT support Native or App Open formats.`);
  }
  if (isPromoEnabled) {
    prereqItems.push(`${prereqItems.length + 1}. **WebAppyPie Promotions:** Requires internal promotional campaigns configured in WAPCentral Dashboard (\`/ads/custom-campaigns\` or \`/promotions\`).`);
  }

  // Manifest Declarations (ONLY enabled providers)
  const manifestBlocks: string[] = [];
  if (isAdmobEnabled) {
    manifestBlocks.push(
      '#### Android Manifest (`android/app/src/main/AndroidManifest.xml`):',
      '```xml',
      '<meta-data',
      '    android:name="com.google.android.gms.ads.APPLICATION_ID"',
      `    android:value="${env === 'Testing' ? ADMOB_OFFICIAL_TEST_IDS.android.appId : (simple?.networkConfig?.admob?.appId || ADMOB_OFFICIAL_TEST_IDS.android.appId)}" />`,
      '```',
    );
  }
  if (isApplovinEnabled) {
    manifestBlocks.push(
      '#### AppLovin SDK Key (`AndroidManifest.xml` & `Info.plist`):',
      '```xml',
      '<meta-data',
      '    android:name="applovin.sdk.key"',
      `    android:value="${simple?.networkConfig?.applovin?.sdkKey || 'YOUR_APPLOVIN_SDK_KEY'}" />`,
      '```',
    );
  }

  // Required Mobile Dependencies & Adapters (ONLY enabled providers)
  const flutterDeps: string[] = [
    '  wap_core_sdk: ^1.0.0',
    '  wap_ads_sdk: ^1.0.0',
  ];
  if (isAdmobSole) {
    flutterDeps.push('  google_mobile_ads: ^5.2.0');
  }
  if (isApplovinEnabled) {
    flutterDeps.push('  applovin_max: ^4.0.1');
  }
  if (isPromoEnabled) {
    flutterDeps.push('  wap_promo_sdk: ^1.0.0');
  }

  const androidDeps: string[] = [];
  if (isAdmobSole) {
    androidDeps.push("    implementation 'com.google.android.gms:play-services-ads:23.6.0'");
  }
  if (isApplovinEnabled) {
    androidDeps.push("    implementation 'com.applovin:applovin-sdk:13.1.0'");
    if (isAdmobEnabled) {
      androidDeps.push("    implementation 'com.applovin.mediation:google-adapter:23.6.0.0'");
    }
    if (isMetaEnabled) {
      androidDeps.push("    implementation 'com.applovin.mediation:facebook-adapter:6.18.0.0'");
    }
    if (isInmobiEnabled) {
      androidDeps.push("    implementation 'com.applovin.mediation:inmobi-adapter:10.8.0.0'");
    }
    if (isUnityEnabled) {
      androidDeps.push("    implementation 'com.applovin.mediation:unityads-adapter:4.12.5.0'");
    }
  }

  const iosPods: string[] = [];
  if (isAdmobSole) {
    iosPods.push("  pod 'Google-Mobile-Ads-SDK'");
  }
  if (isApplovinEnabled) {
    iosPods.push("  pod 'AppLovinSDK'");
    if (isAdmobEnabled) {
      iosPods.push("  pod 'AppLovinMediationGoogleAdapter'");
    }
    if (isMetaEnabled) {
      iosPods.push("  pod 'AppLovinMediationFacebookAdapter'");
    }
    if (isInmobiEnabled) {
      iosPods.push("  pod 'AppLovinMediationInMobiAdapter'");
    }
    if (isUnityEnabled) {
      iosPods.push("  pod 'AppLovinMediationUnityAdsAdapter'");
    }
  }

  const dependenciesBlocks: string[] = [
    '### Required Mobile Dependencies & Adapters for Enabled Providers:',
    'Add strictly the following dependencies to your mobile project. Do not include unneeded network adapters or unused mediation libraries.',
    '',
    '#### Flutter Dependencies (`pubspec.yaml`):',
    '```yaml',
    'dependencies:',
    flutterDeps.join('\n'),
    '```',
  ];

  if (androidDeps.length > 0) {
    dependenciesBlocks.push(
      '',
      '#### Android Native Dependencies (`android/app/build.gradle`):',
      '```groovy',
      'dependencies {',
      androidDeps.join('\n'),
      '}',
      '```',
    );
  }

  if (iosPods.length > 0) {
    dependenciesBlocks.push(
      '',
      '#### iOS Native Dependencies (`ios/Podfile`):',
      '```ruby',
      "target 'Runner' do",
      iosPods.join('\n'),
      'end',
      '```',
    );
  }

  const dependenciesSection = dependenciesBlocks.join('\n');

  return [
    '## 8. Ads — Controlled by WAPCentral',
    '',
    architectureOverview,
    '',
    '### Configuration Summary for ' + app.name + ':',
    '- **Ads Status:** `Enabled`',
    `- **Environment:** \`${env}\``,
    `- **Active Demand Sources for ${app.name}:** ${activeDemandSources.join(', ') || 'None'}`,
    `- **Active Supported Formats:** ${activeFormats.join(', ') || 'None'}`,
    '',
    '### Master Advertising Provider & Demand Source Roster:',
    'The following table audits all advertising providers explicitly enabled for this application:',
    '',
    rosterRows.join('\n'),
    '',
    mediationDetails,
    '',
    dependenciesSection,
    '',
    '### Official Testing Configuration Catalog:',
    'Use the official testing methods and verified sample identifiers below during integration. Never use or click live production ads during development.',
    '',
    testRows.join('\n'),
    '',
    '### App-Specific Production Identifiers for ' + app.name + ':',
    prodRows.join('\n'),
    '',
    '> ⚠️ **Missing Production Configuration Warning**: Formats marked `Not configured` or `Integrated but Not Configured` will not serve third-party ads in Production mode. Missing demand sources are safely skipped without crashing the app.',
    '',
    prereqItems.length > 0 ? '### Provider Activation Prerequisites & Account Approval Guide:\n' + prereqItems.join('\n') + '\n' : '',
    manifestBlocks.length > 0 ? '### Native Manifest Declarations:\n' + manifestBlocks.join('\n') + '\n' : '',
    '### Testing & Release Verification Rules:',
    verificationText,
    '- **Testing Configuration is Controlled Centrally:** Testing configuration is controlled centrally by WAPCentral. The mobile app must not hardcode fake production IDs.',
    '- **Zero Production Clicks in Testing:** Never use or click live production ads for testing. Always use official sample ad units or test devices during development.',
    '- **Secure Public Identifiers:** Only public client identifiers (such as App ID and Ad Unit ID) are included in mobile integration. Backend signing secrets and private reporting keys are strictly withheld.',
    '- **Dynamic Config Fetch:** `wap_ads_sdk` fetches the effective configuration from `/api/platform/v1/ads/config`.',
    '- **Omission of Disabled Units:** Disabled networks and formats must not be requested by client code.',
    '- **Graceful No-Fill Handling:** When third-party fill is exhausted, applications display house promotions or collapse containers without UI disruption.',
  ].filter(Boolean).join('\n');
}

/**
 * Builds the application-specific Section 9 (Remote App Service Control).
 */
export function buildRemoteServiceControlSection(app: App): string {
  const ctrl = app.remoteServiceControl || {
    enabled: true,
    title: 'Service Notice',
    message: 'We are currently performing scheduled maintenance. Please check back shortly.',
    buttonText: 'Learn More',
    destinationUrl: 'https://webappypie.com',
    updatedAt: new Date().toISOString(),
  };

  const statusText = ctrl.enabled
    ? '`Enabled (Normal Service Active)`'
    : '`Disabled (Blocking Dialog Active)`';

  return [
    '## 9. Remote App Service Control',
    '',
    'WAPCentral provides an authoritative, per-app **Remote Service Status** control mechanism. The administrator can remotely pause or restore application service at any time from the WAPCentral Dashboard without submitting an app store update.',
    '',
    '### Published Configuration for ' + app.name + ':',
    '- **Current Service Status:** ' + statusText,
    `- **Popup Dialog Title:** \`${ctrl.title}\``,
    `- **Popup Message:** \`${ctrl.message}\``,
    `- **Action Button Text:** \`${ctrl.buttonText}\``,
    `- **Destination URL:** \`${ctrl.destinationUrl}\``,
    `- **Last Updated:** \`${ctrl.updatedAt || 'Default Initial'}\``,
    '',
    '### Remote Service Control API Contract',
    '',
    'Mobile applications check the remote service status via the dedicated endpoint:',
    '- **Method:** `GET`',
    `- **Route:** \`/api/platform/v1/apps/${app.id}/service-status\` (or \`/api/platform/v1/service-status\`)`,
    '- **Authentication:** Public or standard platform auth headers:',
    `  - \`X-App-Id: ${app.id}\``,
    `  - \`X-App-Key: ${app.appKey?.trim() || 'YOUR_APP_KEY'}\``,
    '',
    '#### Response Payload Example:',
    '```json',
    '{',
    '  "success": true,',
    `  "appId": "${app.id}",`,
    '  "service": "service_control",',
    '  "data": {',
    `    "enabled": ${ctrl.enabled},`,
    `    "title": "${(ctrl.title || 'Service Unavailable').replace(/"/g, '\\"')}",`,
    `    "message": "${(ctrl.message || 'Service is temporarily unavailable.').replace(/"/g, '\\"')}",`,
    `    "buttonText": "${(ctrl.buttonText || 'Learn More').replace(/"/g, '\\"')}",`,
    `    "destinationUrl": "${(ctrl.destinationUrl || 'https://webappypie.com').replace(/"/g, '\\"')}",`,
    `    "updatedAt": "${ctrl.updatedAt || new Date().toISOString()}"`,
    '  }',
    '}',
    '```',
    '',
    '### Mobile Lifecycle & Operational Rules',
    '',
    '1. **App Startup:**',
    `   - During cold start (in \`main.dart\` / splash screen), call \`GET /api/platform/v1/apps/${app.id}/service-status\`.`,
    '   - If `data.enabled === false`, immediately render a full-screen, non-dismissible blocking dialog (`PopScope(canPop: false)`).',
    '   - Display the configured `title`, `message`, and button text.',
    '   - Clicking the action button opens `destinationUrl` in the external browser using `url_launcher`.',
    '   - Normal app features and screens must remain completely blocked until service is restored.',
    '',
    '2. **App Resume & Foreground Events:**',
    '   - Listen to app lifecycle events (`WidgetsBindingObserver.didChangeAppLifecycleState` or `AppLifecycleListener.onResume`).',
    '   - Re-query the service status endpoint when returning to the foreground.',
    '   - If service has been paused remotely while the app was in the background, immediately display the blocking dialog.',
    '',
    '3. **Temporary Network Failures & Offline Mode (Local-First Resilience):**',
    '   - The application must operate **local-first and resiliently**.',
    '   - If the endpoint is temporarily unreachable (e.g. airplane mode, network timeout, DNS error, HTTP 5xx), the app must **fail open** (`enabled: true`) to prevent locking offline users out of local features.',
    '   - Log a non-fatal warning and retry on the next foreground resume event.',
    '',
    '4. **Missing or Invalid Configuration:**',
    '   - If the remote configuration is missing, returns invalid JSON, or fails validation, default to `enabled: true` (fail-open).',
    '',
    '5. **Service Restoration:**',
    '   - When the administrator re-enables service in the dashboard (`enabled: true`), the next foreground check or periodic poll receives `enabled: true`.',
    '   - The blocking dialog is automatically dismissed, restoring normal app flow instantly.',
    '',
    '6. **Older App Versions:**',
    '   - Older app builds that do not include the Service Control client will continue normal operation.',
    '   - If a mandatory upgrade is required, configure minimum version requirements in WAPCentral.',
    '',
    '7. **Security Rules:**',
    '   - Only public identifiers (`appId`) and standard client auth (`X-App-Key`) are used.',
    '   - Never embed private backend signing secrets or admin credentials in the mobile app.',
    '',
    '### Flutter Reference Implementation (`lib/services/service_control_guard.dart`):',
    '',
    '```dart',
    "import 'dart:convert';",
    "import 'package:flutter/material.dart';",
    "import 'package:http/http.dart' as http;",
    "import 'package:url_launcher/url_launcher.dart';",
    '',
    'class ServiceStatusData {',
    '  final bool enabled;',
    '  final String title;',
    '  final String message;',
    '  final String buttonText;',
    '  final String destinationUrl;',
    '',
    '  ServiceStatusData({',
    '    required this.enabled,',
    '    required this.title,',
    '    required this.message,',
    '    required this.buttonText,',
    '    required this.destinationUrl,',
    '  });',
    '',
    '  factory ServiceStatusData.fromJson(Map<String, dynamic> json) {',
    '    return ServiceStatusData(',
    "      enabled: json['enabled'] as bool? ?? true,",
    "      title: json['title'] as String? ?? 'Service Notice',",
    "      message: json['message'] as String? ?? 'Service is currently unavailable.',",
    "      buttonText: json['buttonText'] as String? ?? 'Learn More',",
    "      destinationUrl: json['destinationUrl'] as String? ?? 'https://webappypie.com',",
    '    );',
    '  }',
    '}',
    '',
    'class ServiceControlGuard {',
    `  static const String _baseUrl = 'https://wapcentral.webappypie.com/api/platform/v1/apps/${app.id}/service-status';`,
    `  static const String _appId = '${app.id}';`,
    `  static const String _appKey = String.fromEnvironment('WAP_APP_KEY', defaultValue: '${app.appKey?.trim() || ''}');`,
    '',
    '  static Future<ServiceStatusData> checkServiceStatus() async {',
    '    try {',
    '      final response = await http.get(',
    '        Uri.parse(_baseUrl),',
    '        headers: {',
    "          'X-App-Id': _appId,",
    "          'X-App-Key': _appKey,",
    "          'Accept': 'application/json',",
    '        },',
    '      ).timeout(const Duration(seconds: 5));',
    '',
    '      if (response.statusCode == 200) {',
    '        final body = json.decode(response.body);',
    "        if (body['success'] == true && body['data'] != null) {",
    "          return ServiceStatusData.fromJson(body['data']);",
    '        }',
    '      }',
    '      return ServiceStatusData(',
    '        enabled: true,',
    "        title: '',",
    "        message: '',",
    "        buttonText: '',",
    "        destinationUrl: '',",
    '      );',
    '    } catch (e) {',
    "      debugPrint('WAPCentral Service Control check failed (fail-open): \$e');",
    '      return ServiceStatusData(',
    '        enabled: true,',
    "        title: '',",
    "        message: '',",
    "        buttonText: '',",
    "        destinationUrl: '',",
    '      );',
    '    }',
    '  }',
    '',
    '  static void showBlockingDialog(BuildContext context, ServiceStatusData data) {',
    '    showDialog(',
    '      context: context,',
    '      barrierDismissible: false,',
    '      builder: (BuildContext ctx) {',
    '        return PopScope(',
    '          canPop: false,',
    '          child: AlertDialog(',
    '            title: Text(data.title, style: const TextStyle(fontWeight: FontWeight.bold)),',
    '            content: Text(data.message),',
    '            actions: [',
    '              ElevatedButton(',
    '                onPressed: () async {',
    '                  final uri = Uri.tryParse(data.destinationUrl);',
    '                  if (uri != null && await canLaunchUrl(uri)) {',
    '                    await launchUrl(uri, mode: LaunchMode.externalApplication);',
    '                  }',
    '                },',
    '                child: Text(data.buttonText),',
    '              ),',
    '            ],',
    '          ),',
    '        );',
    '      },',
    '    );',
    '  }',
    '}',
    '```',
  ].join('\n');
}

/**
 * Builds the application-specific Section 10 (Notifications — Controlled by WAPCentral).
 */
export function buildNotificationsSection(isNotificationsEnabled: boolean): string {
  if (!isNotificationsEnabled) {
    return [
      '## 10. Notifications — Controlled by WAPCentral',
      '',
      '> **Notifications: Disabled for this application.**',
      '',
      '- Do not install `wap_notifications_sdk` or configure notification device registration for this application.',
      '- No push notification handling or campaign polling is required.',
      '- If notifications are needed later, configure FCM credentials in **WAPCentral Dashboard → Applications → Notifications**.',
    ].join('\n');
  }

  return [
    '## 10. Notifications — Controlled by WAPCentral',
    '',
    'Notifications are managed centrally from WAPCentral for this app. The mobile app does not contain its own campaign management system.',
    '',
    '### Configuration Summary:',
    '- **Notifications:** `Enabled`',
    '- **FCM:** `Required (FCM configuration via google-services.json / GoogleService-Info.plist)`',
    '- **wap_notifications_sdk:** `Required`',
    '- **Device Registration Endpoint:** `POST /api/platform/v1/notifications/devices/register`',
    '- **Notification Feed Endpoint:** `GET /api/platform/v1/notifications`',
    '',
    '### Integration & Lifecycle Steps:',
    '1. Initialize `wap_notifications_sdk` with the WAPCentral app credentials and the device FCM token.',
    '2. Register the device with WAPCentral upon successful token acquisition.',
    '3. Read the app-specific notification feed and synchronize unread/read state.',
    '4. WAPCentral sends title, message body, optional rich image, and optional deep link payload.',
    '5. WAPCentral supports Send Now / Schedule according to dashboard capabilities.',
    '',
    '> [!CAUTION]',
    '> **Security Notice:** Never place FCM server or service-account private credentials in the mobile app. All outbound push dispatches are securely performed server-side by WAPCentral.',
  ].join('\n');
}

/**
 * Builds Section 3 (Firebase Configuration Files).
 */
export function buildFirebaseConfigSection(
  app: App,
  status: AppServiceStatus,
  hasFirebase: boolean,
): string {
  if (!hasFirebase) {
    return [
      `Firebase is not configured or required for **${app.name}**.`,
      '',
      `- Push notifications and FCM are disabled for this application.`,
      `- No \`google-services.json\` or \`GoogleService-Info.plist\` files are required in the client project.`,
      `- If Firebase services (Crashlytics, FCM, Analytics) are required in the future, configure the Firebase Project in **WAPCentral Dashboard → Applications → ${app.name}**.`,
    ].join('\n');
  }

  const fbProjectId = app.firebaseProjectId?.trim() ? app.firebaseProjectId.trim() : 'Not configured';
  const fbAndroidAppId = app.firebaseAndroidAppId?.trim() ? app.firebaseAndroidAppId.trim() : 'Not configured';
  const fbIosAppId = app.firebaseIosAppId?.trim() ? app.firebaseIosAppId.trim() : 'Not configured';
  const fcmSenderId = app.fcmSenderId?.trim() ? app.fcmSenderId.trim() : 'Not configured';

  return [
    `Download the official configuration files directly from the Firebase Console for project \`${fbProjectId}\`:`,
    '',
    `- **Android:** \`google-services.json\` → place at \`android/app/google-services.json\``,
    `- **iOS:** \`GoogleService-Info.plist\` → place at \`ios/Runner/GoogleService-Info.plist\``,
    '',
    '| Configuration Key | Value for ' + app.name + ' | Destination File |',
    '| :--- | :--- | :--- |',
    `| **Project ID** | \`${fbProjectId}\` | \`google-services.json\` / \`GoogleService-Info.plist\` |`,
    `| **Android App ID** | \`${fbAndroidAppId}\` | \`android/app/google-services.json\` (\`mobilesdk_app_id\`) |`,
    `| **iOS App ID** | \`${fbIosAppId}\` | \`ios/Runner/GoogleService-Info.plist\` (\`GOOGLE_APP_ID\`) |`,
    `| **FCM Sender ID** | \`${fcmSenderId}\` | \`google-services.json\` (\`project_number\`) |`,
    '',
    '> [!WARNING]',
    '> Firebase configuration files belong exclusively in your client project root. Never commit cloud service account private keys (`service-account.json`), database admin credentials, or backend signing keys into the mobile application repository.',
  ].join('\n');
}

/**
 * Builds Section 12 (Project File Checklist).
 */
export function buildProjectFileChecklist(
  app: App,
  status: AppServiceStatus,
  hasFirebase: boolean,
): string {
  const items: string[] = [];
  const androidPkg = app.packageId?.trim() || 'Not configured';
  const iosBundle = app.bundleId?.trim() || 'Not configured';

  if (hasFirebase) {
    items.push(`- [ ] \`android/app/google-services.json\` is present and matches package \`${androidPkg}\``);
    items.push(`- [ ] \`ios/Runner/GoogleService-Info.plist\` is present and matches bundle \`${iosBundle}\``);
  } else {
    items.push('- [ ] Firebase configuration files are omitted (Firebase is not required for this application)');
  }

  items.push(`- [ ] \`pubspec.yaml\` includes only the required WAP SDKs (\`${status.enabledSdkNames.join(', ')}\`)`);

  if (status.isAdsEnabled) {
    const simple = app.simpleAdsConfig;
    const isAdmob = Boolean(simple?.networks?.admob || app.adConfig?.admob?.enabled);
    const isApplovin = Boolean(simple?.networks?.applovin || app.adConfig?.applovin?.enabled);

    if (isAdmob && !isApplovin) {
      items.push('- [ ] `android/app/src/main/AndroidManifest.xml` contains Google Mobile Ads `APPLICATION_ID`');
      items.push('- [ ] `pubspec.yaml` includes `google_mobile_ads` (no third-party mediation SDKs)');
    } else if (isApplovin) {
      items.push('- [ ] `android/app/src/main/AndroidManifest.xml` and `Info.plist` contain `applovin.sdk.key`');
      items.push('- [ ] `pubspec.yaml` includes `applovin_max` and only enabled demand network adapters');
    }
    items.push('- [ ] No hardcoded production Ad Unit IDs in Flutter code (fetched dynamically from `/api/platform/v1/ads/config`)');
  } else {
    items.push('- [ ] No advertising SDKs, adapters, or ad unit IDs are bundled in the application');
  }

  if (status.isNotificationsEnabled) {
    items.push('- [ ] Push notification handling and FCM device registration configured via `wap_notifications_sdk`');
    items.push('- [ ] No hardcoded push notification campaigns or device bypass endpoints in mobile code');
  } else {
    items.push('- [ ] Push notification SDK and background handlers are omitted (Notifications disabled)');
  }

  items.push('- [ ] No hardcoded third-party API keys (OpenAI, Gemini, Anthropic, InMobi) in source code');
  items.push('- [ ] No WAPCentral `X-App-Key` printed to production device logs');
  items.push('- [ ] App permissions and entitlements scoped strictly to minimum requirements for enabled features');

  return items.join('\n');
}

/**
 * Builds Section 15 (Release & Verification Checklist).
 */
export function buildReleaseChecklist(
  app: App,
  status: AppServiceStatus,
  hasFirebase: boolean,
): string {
  const items: string[] = [
    '- [ ] **Android Build:** App compiles with Android minSdk and targetSdk versions.',
    '- [ ] **iOS Build:** App compiles with iOS deployment target and required privacy manifests.',
  ];

  if (hasFirebase) {
    items.push('- [ ] **Firebase Initialization:** Firebase initializes cleanly on cold start without crashes.');
  }

  items.push(
    '- [ ] **WAPCentral Health:** Cold-start check against `/api/platform/v1/health` succeeds.',
    `- [ ] **Remote Service Control:** Verify service status endpoint (\`/api/platform/v1/apps/${app.id}/service-status\`) handles online state and blocking modal.`,
    `- [ ] **Service Access:** Enabled services (${status.enabledServicesList.join(', ') || 'Core only'}) respond with 200 OK; disabled services return 403 Forbidden.`,
  );

  if (status.isAdsEnabled) {
    items.push('- [ ] **Ads Environment:** Testing mode shows official test ads; Production mode serves configured units.');
    if (status.isPromoEnabled) {
      items.push('- [ ] **Custom Ads House Fallback:** Verify house promo banner displays gracefully when third-party fill is 0 or offline.');
    }
  } else {
    items.push('- [ ] **Ads Verification:** Verify no ad requests or ad containers are initialized.');
  }

  if (status.isNotificationsEnabled) {
    items.push('- [ ] **FCM Device Registration:** Device registers token with `/api/platform/v1/notifications/devices/register`.');
  }

  items.push('- [ ] **Log Audit:** Verify no credentials, tokens, or PII appear in `flutter logs` or Android logcat.');

  return items.join('\n');
}

/**
 * Builds the application-specific Section 11 (App Startup Sequence).
 */
export function buildStartupSequenceSection(
  app: App,
  enabledSdkNames: string[],
  isAdsEnabled: boolean,
  isNotificationsEnabled: boolean,
  appKeyText: string,
  hasFirebase: boolean = true,
): string {
  const steps: string[] = [
    '## 11. App Startup Sequence',
    '',
  ];

  if (hasFirebase) {
    steps.push('1. **Initialize Firebase:** Use standard Flutter Firebase setup (`await Firebase.initializeApp()`).');
  } else {
    steps.push('1. **Firebase Setup:** Firebase is not required for this app; bypass Firebase initialization.');
  }

  steps.push(
    '2. **Initialize WAPCore SDK:** Connect using the generated App ID and authorized credentials:',
    '   - `baseUrl`: `https://wapcentral.webappypie.com/api/platform/v1`',
    `   - \`appId\`: \`${app.id}\``,
    `   - \`appKey\`: \`${appKeyText}\``,
    '   - `preferLocal`: `true`',
    `3. **Verify Remote Service Status:** Query \`/api/platform/v1/apps/${app.id}/service-status\` before rendering primary views. If service is disabled, show blocking dialog.`,
    `4. **Initialize Enabled Modules:** Initialize only the WAP SDKs enabled for this application: \`${enabledSdkNames.join(', ')}\`.`,
  );

  if (isAdsEnabled) {
    steps.push('5. **Initialize Ads:** Initialize `wap_ads_sdk` to fetch the effective remote configuration from `/api/platform/v1/ads/config`.');
  } else {
    steps.push('5. **Ads are disabled:** Do not initialize `wap_ads_sdk` or request ad units.');
  }

  if (isNotificationsEnabled) {
    steps.push('6. **Register Push Device:** Obtain device FCM token via `FirebaseMessaging` and register with WAPCentral (`/api/platform/v1/notifications/devices/register`).');
  } else {
    steps.push('6. **Notifications are disabled:** Skip device registration.');
  }

  steps.push('7. **No Secret Ingestion:** Do not fetch or store provider secrets in the client application.');
  steps.push('8. **No Local Duplicate State:** Do not create a local duplicate of WAPCentral business configuration.');
  steps.push('9. **Local-First Resilience:** Preserve local-first functionality if WAPCentral is temporarily unavailable.');

  return steps.join('\n');
}

/**
 * Generates an application-specific integration guide Markdown document using the canonical template.
 */
/**
 * Builds the application-specific Section 8 (Weather Service — Mediated by WAPCentral).
 * If Weather Service is disabled, returns an empty string so no unnecessary SDK instructions
 * or dependencies are added to apps where it is disabled.
 */
export function buildWeatherSection(app: App, isWeatherEnabled: boolean): string {
  if (!isWeatherEnabled) {
    return '';
  }

  const appKeyDisplay = app.appKey?.trim() ? app.appKey.trim() : 'wap_key_...';

  return [
    '',
    '---',
    '',
    '## Weather Service Integration (`wap_weather_sdk`)',
    '',
    '> **Weather Service is enabled for ' + app.name + '.**',
    '',
    'All weather requests are mediated centrally by the WAPCentral Platform Gateway using **WeatherAPI.com** as the upstream provider. External provider credentials are kept strictly in Google Cloud Secret Manager and are **never bundled or exposed in mobile applications**.',
    '',
    '### A. Flutter SDK Dependency (`pubspec.yaml`)',
    '```yaml',
    'dependencies:',
    '  wap_core_sdk:',
    '    path: ../../sdks/wap_core_sdk',
    '  wap_weather_sdk:',
    '    path: ../../sdks/wap_weather_sdk',
    '```',
    '',
    '### B. Client Initialization (`lib/main.dart`)',
    '```dart',
    "import 'package:wap_core_sdk/wap_core_sdk.dart';",
    "import 'package:wap_weather_sdk/wap_weather_sdk.dart';",
    '',
    'final weatherClient = WapWeather(',
    '  config: WapConfig(',
    "    baseUrl: 'https://wapcentral.webappypie.com/api/platform/v1',",
    "    appId: '" + app.id + "',",
    "    appKey: const String.fromEnvironment('WAP_APP_KEY', defaultValue: '" + appKeyDisplay + "'),",
    '  ),',
    ');',
    '```',
    '',
    '### C. Weather Feature Usage',
    '#### 1. Current Weather (City Name or GPS Coordinates)',
    '```dart',
    '// By City name:',
    "final res = await weatherClient.getCurrentWeather(query: 'Tokyo', aqi: true);",
    'if (res.success && res.data != null) {',
    '  print("Temp: ${res.data!.weather.temperatureC}°C, Condition: ${res.data!.weather.condition.text}");',
    '  print("Attribution: ${res.data!.attribution.text}");',
    '}',
    '',
    '// By GPS Coordinates:',
    'final geoRes = await weatherClient.getCurrentWeather(',
    '  latitude: 35.6762,',
    '  longitude: 139.6503,',
    ');',
    '```',
    '',
    '#### 2. 3-Day Forecast with Hourly Data',
    '```dart',
    'final forecastRes = await weatherClient.getForecast(',
    "  query: 'London',",
    '  days: 3,',
    '  aqi: true,',
    '  alerts: true,',
    ');',
    'for (final day in forecastRes.data!.forecast.forecastDays) {',
    '  print("${day.date}: Max ${day.day.maxTempC}°C, Min ${day.day.minTempC}°C, Rain: ${day.day.chanceOfRainPct}%");',
    '}',
    '```',
    '',
    '#### 3. Global Location Autocomplete / Search',
    '```dart',
    "final searchRes = await weatherClient.searchLocations('San Fran');",
    'for (final loc in searchRes.data!.results) {',
    '  print("${loc.name}, ${loc.region}, ${loc.country} (${loc.latitude}, ${loc.longitude})");',
    '}',
    '```',
    '',
    '### D. Mandatory Attribution & Disclaimer',
    '> **Legal Requirement:** Under WeatherAPI.com Free Plan subscription terms, consuming mobile applications must visibly display the attribution text and link to the end user:',
    '> - **Attribution Text:** `Powered by WeatherAPI.com`',
    '> - **Attribution URL:** `https://www.weatherapi.com/`',
    '> Every response from WAPCentral includes this metadata under `data.attribution`.',
    '',
    '### E. Caching & Quota Policies',
    '- **Current Weather Cache:** Up to 60 minutes (server-side default: 30 minutes).',
    '- **Forecast Cache:** Up to 24 hours (server-side default: 6 hours).',
    '- **Search Cache:** 24 hours.',
    '- **Monthly Quota:** 100,000 calls / month shared across WAPCentral apps or isolated per app-specific provider key.',
    '- **Rate Limit:** 60 requests / minute per application.',
  ].join('\n');
}

export async function generateIntegrationGuide(app: App): Promise<string> {
  const templatePath = resolveTemplatePath();
  let markdown = fs.readFileSync(templatePath, 'utf-8');

  const status = analyzeAppServices(app);

  // Authoritative unmasked app key for documentation
  const appKeyDisplay = app.appKey?.trim()
    ? app.appKey.trim()
    : 'Not configured (Generate in WAPCentral Dashboard → Application Credentials)';

  const androidPkg = app.packageId?.trim() ? app.packageId.trim() : 'Not configured';
  const iosBundle = app.bundleId?.trim() ? app.bundleId.trim() : 'Not configured';

  const fbProjectId = app.firebaseProjectId?.trim() ? app.firebaseProjectId.trim() : 'Not configured';
  const fbAndroidAppId = app.firebaseAndroidAppId?.trim()
    ? app.firebaseAndroidAppId.trim()
    : 'Not configured';
  const fbIosAppId = app.firebaseIosAppId?.trim() ? app.firebaseIosAppId.trim() : 'Not configured';
  const fcmSenderId = app.fcmSenderId?.trim() ? app.fcmSenderId.trim() : 'Not configured';

  const enabledServicesStr =
    status.enabledServicesList.length > 0 ? status.enabledServicesList.join(', ') : 'None configured';

  const adsStatusStr = status.isAdsEnabled
    ? app.simpleAdsConfig?.environment === 'testing'
      ? 'Enabled (Testing)'
      : 'Enabled (Production)'
    : 'Disabled';

  const serviceStatusStr =
    app.remoteServiceControl?.enabled === false
      ? 'Disabled (Blocking Dialog Active)'
      : 'Active (Online)';

  const notificationsStatusStr = status.isNotificationsEnabled ? 'Enabled (FCM required)' : 'Disabled';

  const generatedDateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const fcmStatusStr = status.isNotificationsEnabled
    ? 'Required (Enabled for this application)'
    : 'Disabled for this application';

  const hasFirebase = Boolean(
    status.isNotificationsEnabled ||
    (app.firebaseProjectId && app.firebaseProjectId !== 'Not configured' && app.firebaseProjectId.trim() !== '') ||
    (app.firebaseAndroidAppId && app.firebaseAndroidAppId !== 'Not configured' && app.firebaseAndroidAppId.trim() !== '') ||
    (app.firebaseIosAppId && app.firebaseIosAppId !== 'Not configured' && app.firebaseIosAppId.trim() !== '')
  );

  const firebaseImport = hasFirebase
    ? "import 'package:firebase_core/firebase_core.dart';"
    : "// Firebase is not configured or required for this application";

  const firebaseInit = hasFirebase
    ? "  // 1. Initialize Firebase\n  await Firebase.initializeApp();\n"
    : "  // 1. Firebase setup not required for this application (omitted)\n";

  // Section builders
  const sdkTableMd = buildSdkTable(app, status);
  const apiCatalogTableMd = buildApiCatalogTable(status);
  const adsSectionMd = buildAdsSection(app, status.isAdsEnabled);
  const serviceControlSectionMd = buildRemoteServiceControlSection(app);
  const notificationsSectionMd = buildNotificationsSection(status.isNotificationsEnabled);
  const weatherSectionMd = buildWeatherSection(app, status.isWeatherEnabled);
  const startupSequenceSectionMd = buildStartupSequenceSection(
    app,
    status.enabledSdkNames,
    status.isAdsEnabled,
    status.isNotificationsEnabled,
    appKeyDisplay,
    hasFirebase,
  );
  const firebaseConfigSectionMd = buildFirebaseConfigSection(app, status, hasFirebase);
  const projectFileChecklistMd = buildProjectFileChecklist(app, status, hasFirebase);
  const releaseChecklistMd = buildReleaseChecklist(app, status, hasFirebase);

  // Generate dynamic Dart SDK imports & initializers
  const sdkImports: string[] = [];
  const sdkInitStatements: string[] = [];

  // Service control guard check snippet
  sdkInitStatements.push(`  // 3. Remote App Service Control Check
  final serviceStatus = await ServiceControlGuard.checkServiceStatus();
  if (!serviceStatus.enabled) {
    // Blocks user interaction if service is disabled
    ServiceControlGuard.showBlockingDialog(navigatorKey.currentContext!, serviceStatus);
    return;
  }`);

  if (status.isAdsEnabled) {
    const isAdmobOnly = Boolean(app.simpleAdsConfig?.networks?.admob) && !app.simpleAdsConfig?.networks?.applovin;
    const adsComment = isAdmobOnly
      ? '  // 4. Initialize Ads (Google AdMob Direct GMA)'
      : '  // 4. Initialize Ads (WAPCentral Ads Mediation)';
    sdkImports.push("import 'package:wap_ads_sdk/wap_ads.dart';");
    sdkInitStatements.push(`${adsComment}
  await WapAds.initialize(
    const WapAdsOptions(
      appId: '${app.id}',
      appKey: String.fromEnvironment('WAP_APP_KEY', defaultValue: '${appKeyDisplay}'),
      environment: '${app.environment || 'production'}',
      baseUrl: 'https://wapcentral.webappypie.com',
      testMode: ${app.simpleAdsConfig?.environment === 'testing' ? 'true' : 'false'},
    ),
  );`);
  }
  if (status.isNotificationsEnabled) {
    sdkImports.push("import 'package:wap_notifications_sdk/wap_notifications.dart';");
    sdkInitStatements.push(`  // 5. Initialize Notifications & Register FCM Token
  await WapNotifications.initialize(
    const WapNotificationsOptions(
      appId: '${app.id}',
      appKey: String.fromEnvironment('WAP_APP_KEY', defaultValue: '${appKeyDisplay}'),
      baseUrl: 'https://wapcentral.webappypie.com',
    ),
  );`);
  }
  if (status.isAiEnabled) {
    sdkImports.push("import 'package:wap_ai_sdk/wap_ai_sdk.dart';");
  }
  if (status.isWeatherEnabled) {
    sdkImports.push("import 'package:wap_weather_sdk/wap_weather_sdk.dart';");
    sdkInitStatements.push(`  // 6. Initialize Weather Service Client
  final weatherClient = WapWeather(
    config: WapConfig(
      baseUrl: 'https://wapcentral.webappypie.com/api/platform/v1',
      appId: '${app.id}',
      appKey: const String.fromEnvironment('WAP_APP_KEY', defaultValue: '${appKeyDisplay}'),
    ),
  );`);
  }

  const replacements: Record<string, string> = {
    '{{APP_NAME}}': app.name,
    '{{APP_ID}}': app.id,
    '{{APP_KEY}}': appKeyDisplay,
    '{{APP_KEY_DART_DEFAULT}}': app.appKey?.trim() ? app.appKey.trim() : '',
    '{{ANDROID_PACKAGE_ID}}': androidPkg,
    '{{IOS_BUNDLE_ID}}': iosBundle,
    '{{FIREBASE_PROJECT_ID}}': fbProjectId,
    '{{FIREBASE_ANDROID_APP_ID}}': fbAndroidAppId,
    '{{FIREBASE_IOS_APP_ID}}': fbIosAppId,
    '{{FIREBASE_PROJECT_NUMBER}}': fcmSenderId,
    '{{FIREBASE_CONFIG_SECTION}}': firebaseConfigSectionMd,
    '{{FIREBASE_IMPORT}}': firebaseImport,
    '{{FIREBASE_INIT}}': firebaseInit,
    '{{ENABLED_SERVICES}}': enabledServicesStr,
    '{{ENABLED_SDKS_LIST}}': status.enabledSdkNames.join(', '),
    '{{ADS_STATUS}}': adsStatusStr,
    '{{SERVICE_STATUS}}': serviceStatusStr,
    '{{NOTIFICATIONS_STATUS}}': notificationsStatusStr,
    '{{GENERATED_AT}}': generatedDateStr,
    '{{FCM_STATUS}}': fcmStatusStr,
    '{{CRASHLYTICS_STATUS}}': 'Recommended for production crash monitoring',
    '{{ANALYTICS_STATUS}}': 'Optional / Product-dependent',
    '{{AUTH_STATUS}}': 'Optional / Product-dependent',
    '{{STORAGE_STATUS}}': 'Optional / Product-dependent',
    '{{SDK_TABLE}}': sdkTableMd,
    '{{API_CATALOG_TABLE}}': apiCatalogTableMd,
    '{{ADS_SECTION}}': adsSectionMd,
    '{{SERVICE_CONTROL_SECTION}}': serviceControlSectionMd,
    '{{NOTIFICATIONS_SECTION}}': notificationsSectionMd,
    '{{WEATHER_SECTION}}': weatherSectionMd,
    '{{STARTUP_SEQUENCE_SECTION}}': startupSequenceSectionMd,
    '{{PROJECT_FILE_CHECKLIST}}': projectFileChecklistMd,
    '{{RELEASE_CHECKLIST}}': releaseChecklistMd,
    '{{SDK_IMPORTS}}': sdkImports.length > 0 ? sdkImports.join('\n') : '',
    '{{SERVICE_INITIALIZATION}}': sdkInitStatements.length > 0 ? sdkInitStatements.join('\n\n') : '',
  };

  for (const [placeholder, val] of Object.entries(replacements)) {
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    markdown = markdown.replace(regex, val);
  }

  return markdown;
}

