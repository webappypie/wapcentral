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
  const isAdsEnabled =
    allowed.includes('ads') ||
    modules.includes('ads') ||
    Boolean(app.simpleAdsConfig?.adsEnabled) ||
    Boolean(app.adConfig);
  const isNotificationsEnabled =
    allowed.includes('notifications' as any) ||
    modules.includes('notifications' as any) ||
    Boolean(app.fcmSenderId && app.fcmSenderId !== 'Not configured' && app.fcmSenderId.trim() !== '');
  const isPromoEnabled = allowed.includes('promotion' as any) || modules.includes('promotion');

  const enabledServicesList: string[] = [];
  if (isAiEnabled) enabledServicesList.push('AI');
  if (isImageEnabled) enabledServicesList.push('Image');
  if (isOcrEnabled) enabledServicesList.push('OCR');
  if (isFilesEnabled) enabledServicesList.push('Files');
  if (isAdsEnabled) enabledServicesList.push('Ads');
  if (isNotificationsEnabled) enabledServicesList.push('Notifications');
  if (isPromoEnabled) enabledServicesList.push('Promotion');

  const enabledSdkNames: string[] = ['wap_core_sdk'];
  if (isAiEnabled) enabledSdkNames.push('wap_ai_sdk');
  if (isImageEnabled) enabledSdkNames.push('wap_image_sdk');
  if (isOcrEnabled) enabledSdkNames.push('wap_ocr_sdk');
  if (isFilesEnabled) enabledSdkNames.push('wap_file_sdk');
  if (isAdsEnabled) enabledSdkNames.push('wap_ads_sdk');
  if (isNotificationsEnabled) enabledSdkNames.push('wap_notifications_sdk');
  if (isPromoEnabled) enabledSdkNames.push('wap_promo_sdk');

  return {
    isAiEnabled,
    isImageEnabled,
    isOcrEnabled,
    isFilesEnabled,
    isAdsEnabled,
    isNotificationsEnabled,
    isPromoEnabled,
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
    rows.push('| `wap_ads_sdk` | Central Ads configuration, AppLovin MAX mediation, house ads fallback | `✓ Required (Enabled for ' + app.name + ')` |');
  }
  if (status.isNotificationsEnabled) {
    rows.push('| `wap_notifications_sdk` | FCM device token registration, notification feed, read synchronization | `✓ Required (Enabled for ' + app.name + ')` |');
  }
  if (status.isPromoEnabled) {
    rows.push('| `wap_promo_sdk` | Cross-promotional campaign surfaces, interstitials, banners | `✓ Required (Enabled for ' + app.name + ')` |');
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

  return [
    '| Service | Method | Route | Permission Status for this App |',
    '| :--- | :---: | :--- | :--- |',
    '| **Health** | `GET` | `/api/platform/v1/health` | `Public (Available)` |',
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
    `| **Ads** | \`POST\` | \`/api/platform/v1/ads/custom/track\` | \`${adsStatus}\` |`,
    `| **Notifications** | \`POST\` | \`/api/platform/v1/notifications/devices/register\` | \`${notifStatus}\` |`,
    `| **Notifications** | \`GET\` | \`/api/platform/v1/notifications\` | \`${notifStatus}\` |`,
  ].join('\n');
}

/**
 * Builds the application-specific Section 8 (Ads — Controlled by WAPCentral).
 */
export function buildAdsSection(app: App, isAdsEnabled: boolean): string {
  if (!isAdsEnabled) {
    return [
      '## 8. Ads — Controlled by WAPCentral',
      '',
      '> **Ads: Disabled for this application.**',
      '',
      '- Do not install `wap_ads_sdk` or initialize third-party advertising SDKs in this app.',
      '- Do not create local ad views, test banners, or configure ad units in mobile client code.',
      '- If ads are needed in the future, enable them centrally in **WAPCentral Dashboard → Applications → ' + app.name + ' → Ads**.',
    ].join('\n');
  }

  const simple = app.simpleAdsConfig;
  const env =
    simple?.environment === 'testing'
      ? 'Testing'
      : app.environment === 'production'
        ? 'Production'
        : 'Testing';

  const strategy = simple?.strategy === 'single_source' ? 'Single Demand Source' : 'Automatic Mediation';
  const strategyDetails =
    simple?.strategy === 'single_source' && simple.singleSourceNetwork
      ? `${strategy} (${simple.singleSourceNetwork} routed through MAX)`
      : strategy;

  // Demand sources list
  const netList: string[] = [];
  if (simple?.networks?.applovin ?? true) netList.push('AppLovin Demand (Built-in)');
  if (simple?.networks?.admob) netList.push('Google AdMob (MAX Adapter)');
  if (simple?.networks?.meta) netList.push('Meta Audience Network (MAX Adapter)');
  if (simple?.networks?.inmobi) netList.push('InMobi (MAX Adapter)');
  if (simple?.networks?.unity) netList.push('Unity Ads (MAX Adapter)');
  if (simple?.networks?.wapCustomAds ?? true) netList.push('WebAppyPie Custom Ads (House Ads Fallback)');

  // Required adapters for lightweight build
  const adapters: string[] = [
    '- `wap_ads_sdk` (WebAppyPie Unified Ads Client)',
    '- `applovin_max` (AppLovin MAX Flutter SDK / Core Mediation Engine)',
  ];
  if (simple?.networks?.admob) {
    adapters.push('- Google AdMob Mediation Adapter for AppLovin MAX');
  }
  if (simple?.networks?.meta) {
    adapters.push('- Meta Audience Network Mediation Adapter for AppLovin MAX');
  }
  if (simple?.networks?.inmobi) {
    adapters.push('- InMobi Mediation Adapter for AppLovin MAX');
  }
  if (simple?.networks?.unity) {
    adapters.push('- Unity Ads Mediation Adapter for AppLovin MAX');
  }

  // Formats
  const banner = simple?.enabledFormats?.banner ?? true ? 'Banner' : null;
  const native = simple?.enabledFormats?.native ?? true ? 'Native' : null;
  const interstitial = simple?.enabledFormats?.interstitial ?? true ? 'Interstitial' : null;
  const rewarded = simple?.enabledFormats?.rewarded ?? true ? 'Rewarded' : null;
  const appOpen = simple?.enabledFormats?.appOpen ?? true ? 'App Open' : null;
  const rewardedInterstitial = simple?.enabledFormats?.rewardedInterstitial ? 'Rewarded Interstitial' : null;
  const formats = [banner, native, interstitial, rewarded, appOpen, rewardedInterstitial].filter(Boolean);

  // Prerequisites
  const applovinSdkKey = simple?.networkConfig?.applovin?.sdkKey?.trim() || 'Not configured';
  const prereqs: string[] = [
    `- **AppLovin MAX:** AppLovin SDK Key (\`${applovinSdkKey}\`) declared in \`AndroidManifest.xml\` and \`Info.plist\` (\`AppLovinSdkKey\`).`,
  ];
  if (simple?.networks?.admob) {
    const admobAppId = simple.networkConfig?.admob?.appId || (env === 'Testing' ? ADMOB_OFFICIAL_TEST_IDS.android.appId : 'Not configured');
    prereqs.push(`- **Google AdMob:** Google Mobile Ads App ID (\`${admobAppId}\`) declared in \`AndroidManifest.xml\` and \`Info.plist\` (\`GADApplicationIdentifier\`).`);
  }
  if (simple?.networks?.meta) {
    prereqs.push('- **Meta Audience Network:** Account verified with `app-ads.txt` and audience placement registered in Meta Monetization Manager.');
  }
  if (simple?.networks?.inmobi) {
    const inmobiAccount = simple.networkConfig?.inmobi?.accountId?.trim() || 'Not configured';
    prereqs.push(`- **InMobi:** InMobi Account ID (\`${inmobiAccount}\`) and property approved in InMobi console.`);
  }
  if (simple?.networks?.unity) {
    const unityGameId = simple.networkConfig?.unity?.gameId?.trim() || 'Not configured';
    prereqs.push(`- **Unity Ads:** Unity Game ID (\`${unityGameId}\`) registered in Unity Dashboard.`);
  }

  // Testing vs Production verification text
  const verificationText =
    env === 'Testing'
      ? '- **Testing Mode is ACTIVE:** Official SDK test ads and sandbox unit IDs are automatically injected by WAPCentral. No dummy banners or simulated placeholders are used.'
      : '- **Production Mode is ACTIVE:** Genuine provider-reported impressions and auction bids are used. Any missing ad units will show `Not configured` and will be cleanly omitted.';

  // Build Official Testing Configuration Table
  const testTableRows: string[] = [
    '| Provider | Format | Testing Method / Test Identifier | Testing Status | Official Documentation |',
    '| :--- | :--- | :--- | :---: | :--- |',
    '| **AppLovin MAX** | Banner | MAX Test Mode / Mediation Debugger using app MAX Ad Unit ID | `Test mode required` | [AppLovin Test Mode](https://dash.applovin.com/documentation/mediation/test-mode) |',
    '| **AppLovin MAX** | Native | MAX Test Mode / Mediation Debugger using app MAX Native Ad Unit ID | `Test mode required` | [AppLovin Test Mode](https://dash.applovin.com/documentation/mediation/test-mode) |',
    '| **AppLovin MAX** | Interstitial | MAX Test Mode / Mediation Debugger using app MAX Interstitial Ad Unit ID | `Test mode required` | [AppLovin Test Mode](https://dash.applovin.com/documentation/mediation/test-mode) |',
    '| **AppLovin MAX** | Rewarded | MAX Test Mode / Mediation Debugger using app MAX Rewarded Ad Unit ID | `Test mode required` | [AppLovin Test Mode](https://dash.applovin.com/documentation/mediation/test-mode) |',
    '| **AppLovin MAX** | App Open | MAX Test Mode / Mediation Debugger using app MAX App Open Ad Unit ID | `Test mode required` | [AppLovin Test Mode](https://dash.applovin.com/documentation/mediation/test-mode) |',
    '| **AppLovin MAX** | Rewarded Interstitial | MAX Test Mode / Mediation Debugger using app MAX Rewarded Interstitial ID | `Test mode required` | [AppLovin Test Mode](https://dash.applovin.com/documentation/mediation/test-mode) |',
    `| **Google AdMob** | Banner (adaptive) | \`${ADMOB_OFFICIAL_TEST_IDS.android.bannerAdaptive}\` | \`Configured\` | [AdMob Test Ads](https://developers.google.com/admob/android/test-ads#sample_ad_units) |`,
    `| **Google AdMob** | Banner (fixed) | \`${ADMOB_OFFICIAL_TEST_IDS.android.bannerFixed}\` | \`Configured\` | [AdMob Test Ads](https://developers.google.com/admob/android/test-ads#sample_ad_units) |`,
    `| **Google AdMob** | Native | \`${ADMOB_OFFICIAL_TEST_IDS.android.native}\` | \`Configured\` | [AdMob Test Ads](https://developers.google.com/admob/android/test-ads#sample_ad_units) |`,
    `| **Google AdMob** | Interstitial | \`${ADMOB_OFFICIAL_TEST_IDS.android.interstitial}\` | \`Configured\` | [AdMob Test Ads](https://developers.google.com/admob/android/test-ads#sample_ad_units) |`,
    `| **Google AdMob** | Rewarded | \`${ADMOB_OFFICIAL_TEST_IDS.android.rewarded}\` | \`Configured\` | [AdMob Test Ads](https://developers.google.com/admob/android/test-ads#sample_ad_units) |`,
    `| **Google AdMob** | App Open | \`${ADMOB_OFFICIAL_TEST_IDS.android.appOpen}\` | \`Configured\` | [AdMob Test Ads](https://developers.google.com/admob/android/test-ads#sample_ad_units) |`,
    `| **Google AdMob** | Rewarded Interstitial | \`${ADMOB_OFFICIAL_TEST_IDS.android.rewardedInterstitial}\` | \`Configured\` | [AdMob Test Ads](https://developers.google.com/admob/android/test-ads#sample_ad_units) |`,
    '| **Meta Audience Network** | Banner | Test device registration or prefix `IMG_16_9_APP_INSTALL#...` | `Test mode required` | [Meta Test Ads](https://developers.facebook.com/docs/audience-network/guides/test-ads) |',
    '| **Meta Audience Network** | Native | Test device registration or prefix `IMG_16_9_APP_INSTALL#...` | `Test mode required` | [Meta Test Ads](https://developers.facebook.com/docs/audience-network/guides/test-ads) |',
    '| **Meta Audience Network** | Interstitial | Test device registration or prefix `VID_HD_9_16_39S_APP_INSTALL#...` | `Test mode required` | [Meta Test Ads](https://developers.facebook.com/docs/audience-network/guides/test-ads) |',
    '| **Meta Audience Network** | Rewarded | Test device registration or prefix `VID_HD_9_16_39S_APP_INSTALL#...` | `Test mode required` | [Meta Test Ads](https://developers.facebook.com/docs/audience-network/guides/test-ads) |',
    '| **Meta Audience Network** | App Open | Format not supported by Meta | `Not supported` | [Meta Docs](https://developers.facebook.com/docs/audience-network) |',
    '| **Meta Audience Network** | Rewarded Interstitial | Format not supported by Meta | `Not supported` | [Meta Docs](https://developers.facebook.com/docs/audience-network) |',
    '| **InMobi** | Banner / Native / Interstitial / Rewarded | InMobi Portal Test Mode (Toggle ON in portal for Placement) | `Requires provider setup` | [InMobi Testing Guide](https://support.inmobi.com/monetize/integration-guides/android-sdk/testing-your-integration/) |',
    '| **Unity Ads** | Banner | Unity Dashboard Test Mode (Testing: ON) / `Banner_Android` | `Test mode required` | [Unity Ads Testing](https://docs.unity.com/ads/en-us/manual/Testing) |',
    '| **Unity Ads** | Interstitial | Unity Dashboard Test Mode (Testing: ON) / `Interstitial_Android` | `Test mode required` | [Unity Ads Testing](https://docs.unity.com/ads/en-us/manual/Testing) |',
    '| **Unity Ads** | Rewarded | Unity Dashboard Test Mode (Testing: ON) / `Rewarded_Android` | `Test mode required` | [Unity Ads Testing](https://docs.unity.com/ads/en-us/manual/Testing) |',
    '| **WebAppyPie Custom Ads** | Banner / Native / Interstitial / Rewarded | Internal house promo fallback creative (`custom_inhouse`) | `Configured` | [WAPCentral Ads](https://central.webappypie.com/ads) |',
  ];

  // Build Production Configuration Table
  const prodTableRows: string[] = [
    '| Demand Source | Ad Format | Configured Production ID | Status |',
    '| :--- | :--- | :--- | :---: |',
  ];

  const applovinBanner = simple?.networkConfig?.applovin?.placementIds?.banner || 'Not configured';
  const applovinNative = simple?.networkConfig?.applovin?.placementIds?.native || 'Not configured';
  const applovinInterstitial = simple?.networkConfig?.applovin?.placementIds?.interstitial || 'Not configured';
  const applovinRewarded = simple?.networkConfig?.applovin?.placementIds?.rewarded || 'Not configured';
  const applovinAppOpen = simple?.networkConfig?.applovin?.placementIds?.app_open || 'Not configured';
  const applovinRewardedInterstitial = simple?.networkConfig?.applovin?.placementIds?.rewarded_interstitial || 'Not configured';

  prodTableRows.push(`| AppLovin MAX | Banner | \`${applovinBanner}\` | ${applovinBanner !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
  prodTableRows.push(`| AppLovin MAX | Native | \`${applovinNative}\` | ${applovinNative !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
  prodTableRows.push(`| AppLovin MAX | Interstitial | \`${applovinInterstitial}\` | ${applovinInterstitial !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
  prodTableRows.push(`| AppLovin MAX | Rewarded | \`${applovinRewarded}\` | ${applovinRewarded !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
  prodTableRows.push(`| AppLovin MAX | App Open | \`${applovinAppOpen}\` | ${applovinAppOpen !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
  prodTableRows.push(`| AppLovin MAX | Rewarded Interstitial | \`${applovinRewardedInterstitial}\` | ${applovinRewardedInterstitial !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);

  if (simple?.networks?.admob) {
    const admobBanner = simple.networkConfig?.admob?.bannerId || 'Not configured';
    const admobNative = simple.networkConfig?.admob?.nativeId || 'Not configured';
    const admobInterstitial = simple.networkConfig?.admob?.interstitialId || 'Not configured';
    const admobRewarded = simple.networkConfig?.admob?.rewardedId || 'Not configured';
    const admobAppOpen = simple.networkConfig?.admob?.appOpenId || 'Not configured';
    const admobRewardedInterstitial = simple.networkConfig?.admob?.rewardedInterstitialId || 'Not configured';

    prodTableRows.push(`| Google AdMob | Banner | \`${admobBanner}\` | ${admobBanner !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodTableRows.push(`| Google AdMob | Native | \`${admobNative}\` | ${admobNative !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodTableRows.push(`| Google AdMob | Interstitial | \`${admobInterstitial}\` | ${admobInterstitial !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodTableRows.push(`| Google AdMob | Rewarded | \`${admobRewarded}\` | ${admobRewarded !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodTableRows.push(`| Google AdMob | App Open | \`${admobAppOpen}\` | ${admobAppOpen !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodTableRows.push(`| Google AdMob | Rewarded Interstitial | \`${admobRewardedInterstitial}\` | ${admobRewardedInterstitial !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
  }

  if (simple?.networks?.meta) {
    const metaBanner = simple.networkConfig?.meta?.placementIds?.banner || 'Not configured';
    const metaNative = simple.networkConfig?.meta?.placementIds?.native || 'Not configured';
    const metaInterstitial = simple.networkConfig?.meta?.placementIds?.interstitial || 'Not configured';
    const metaRewarded = simple.networkConfig?.meta?.placementIds?.rewarded || 'Not configured';

    prodTableRows.push(`| Meta Audience Network | Banner | \`${metaBanner}\` | ${metaBanner !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodTableRows.push(`| Meta Audience Network | Native | \`${metaNative}\` | ${metaNative !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodTableRows.push(`| Meta Audience Network | Interstitial | \`${metaInterstitial}\` | ${metaInterstitial !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodTableRows.push(`| Meta Audience Network | Rewarded | \`${metaRewarded}\` | ${metaRewarded !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
  }

  if (simple?.networks?.inmobi) {
    const inmobiAccount = simple.networkConfig?.inmobi?.accountId || 'Not configured';
    const inmobiBanner = simple.networkConfig?.inmobi?.placementIds?.banner || 'Not configured';
    const inmobiNative = simple.networkConfig?.inmobi?.placementIds?.native || 'Not configured';
    const inmobiInterstitial = simple.networkConfig?.inmobi?.placementIds?.interstitial || 'Not configured';
    const inmobiRewarded = simple.networkConfig?.inmobi?.placementIds?.rewarded || 'Not configured';

    prodTableRows.push(`| InMobi | Account ID | \`${inmobiAccount}\` | ${inmobiAccount !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodTableRows.push(`| InMobi | Banner | \`${inmobiBanner}\` | ${inmobiBanner !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodTableRows.push(`| InMobi | Native | \`${inmobiNative}\` | ${inmobiNative !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodTableRows.push(`| InMobi | Interstitial | \`${inmobiInterstitial}\` | ${inmobiInterstitial !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodTableRows.push(`| InMobi | Rewarded | \`${inmobiRewarded}\` | ${inmobiRewarded !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
  }

  if (simple?.networks?.unity) {
    const unityGame = simple.networkConfig?.unity?.gameId || 'Not configured';
    const unityBanner = simple.networkConfig?.unity?.placementIds?.banner || 'Not configured';
    const unityInterstitial = simple.networkConfig?.unity?.placementIds?.interstitial || 'Not configured';
    const unityRewarded = simple.networkConfig?.unity?.placementIds?.rewarded || 'Not configured';

    prodTableRows.push(`| Unity Ads | Game ID | \`${unityGame}\` | ${unityGame !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodTableRows.push(`| Unity Ads | Banner | \`${unityBanner}\` | ${unityBanner !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodTableRows.push(`| Unity Ads | Interstitial | \`${unityInterstitial}\` | ${unityInterstitial !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
    prodTableRows.push(`| Unity Ads | Rewarded | \`${unityRewarded}\` | ${unityRewarded !== 'Not configured' ? '`Configured`' : '`Not configured`'} |`);
  }

  return [
    '## 8. Ads — Controlled by WAPCentral',
    '',
    'This app uses **AppLovin MAX as the sole advertising mediation platform**. WAPCentral centrally controls Ads Enabled/Disabled, Ad Strategy, Testing/Production mode, enabled demand sources, enabled formats, and production identifiers for this app. Do not bundle multiple mediation platforms (such as Unity LevelPlay) or duplicate direct SDKs.',
    '',
    '### Configuration Summary:',
    '- **Ads Status:** `Enabled`',
    '- **Mediation Engine:** `AppLovin MAX (Sole Mediation Platform)`',
    `- **Ad Strategy:** \`${strategyDetails}\``,
    `- **Environment:** \`${env}\``,
    `- **Enabled Demand Sources:** ${netList.join(', ') || 'AppLovin Demand, Google AdMob, WebAppyPie Custom Ads'}`,
    `- **Supported Formats:** ${formats.join(', ') || 'Banner, Native, Interstitial, Rewarded, App Open'}`,
    '',
    '### Required Dependencies & Adapters for this Build:',
    'Only bundle the adapters required by enabled demand sources to keep mobile apps lightweight:',
    adapters.join('\n'),
    '',
    '### Provider Prerequisites & Configuration:',
    prereqs.join('\n'),
    '',
    '### Official Testing Configuration Catalog:',
    'Use the official testing methods and verified sample identifiers below during integration. AppLovin MAX uses the same MAX Ad Unit IDs for testing and production, and test ads are enabled via AppLovin MAX Test Mode or Mediation Debugger (`AppLovinMAX.showMediationDebugger()`). Standalone Google AdMob sample IDs are for verifying direct GMA SDK integrations.',
    '',
    testTableRows.join('\n'),
    '',
    '### App-Specific Production Identifiers for ' + app.name + ':',
    prodTableRows.join('\n'),
    '',
    '> ⚠️ **Missing Production Configuration Warning**: Formats marked `Not configured` will not serve third-party ads in Production mode. Missing demand sources are safely skipped without crashing the app. Custom Ads provide automatic high-fill fallback.',
    '',
    '### Instructions for Safely Switching to Production:',
    '1. **Verify Test Ads in Testing Mode:** Ensure all enabled ad formats load test creatives successfully on physical test devices using AppLovin MAX Test Mode / Mediation Debugger (`AppLovinMAX.showMediationDebugger()`).',
    '2. **Obtain Production Ad Unit IDs:** Generate production ad-unit IDs in the AppLovin MAX Dashboard and partner consoles (Google AdMob, Meta, InMobi, Unity).',
    '3. **Update WAPCentral Dashboard:** Navigate to **Applications → ' + app.name + ' → Ads**, populate the production IDs, and switch the Environment toggle to **Production Mode**.',
    '4. **Zero Code Changes Required:** `wap_ads_sdk` dynamically fetches updated configuration from `/api/platform/v1/ads/config` on next app launch. No app recompilation or store update is required to switch environments.',
    '',
    '### Testing & Release Verification Rules:',
    verificationText,
    '- **Testing Configuration is Controlled Centrally:** Testing configuration is controlled centrally by WAPCentral. The mobile app must not hardcode fake production IDs.',
    '- **Dynamic Config Fetch:** `wap_ads_sdk` fetches the effective configuration from `/api/platform/v1/ads/config`.',
    '- **Omission of Disabled Units:** Disabled networks and formats must not be requested by client code.',
    '- **Authentic Metrics:** No fake impressions, revenue, eCPM or fill-rate values.',
    '- **Graceful No-Fill Fallback:** WebAppyPie Custom Ads automatically display as high-fill house promotional fallback when third-party demand is exhausted.',
  ].join('\n');
}

/**
 * Builds the application-specific Section 9 (Notifications — Controlled by WAPCentral).
 */
export function buildNotificationsSection(isNotificationsEnabled: boolean): string {
  if (!isNotificationsEnabled) {
    return [
      '## 9. Notifications — Controlled by WAPCentral',
      '',
      '> **Notifications: Disabled for this application.**',
      '',
      '- Do not install `wap_notifications_sdk` or configure notification device registration for this application.',
      '- No push notification handling or campaign polling is required.',
      '- If notifications are needed later, configure FCM credentials in **WAPCentral Dashboard → Applications → Notifications**.',
    ].join('\n');
  }

  return [
    '## 9. Notifications — Controlled by WAPCentral',
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
 * Builds the application-specific Section 10 (App Startup Sequence).
 */
export function buildStartupSequenceSection(
  app: App,
  enabledSdkNames: string[],
  isAdsEnabled: boolean,
  isNotificationsEnabled: boolean,
  appKeyText: string,
): string {
  const steps: string[] = [
    '## 10. App Startup Sequence',
    '',
    '1. **Initialize Firebase:** Use standard Flutter Firebase setup (`await Firebase.initializeApp()`).',
    '2. **Initialize WAPCore SDK:** Connect using the generated App ID and authorized credentials:',
    '   - `baseUrl`: `https://wapcentral-prod.web.app/api/platform/v1`',
    `   - \`appId\`: \`${app.id}\``,
    `   - \`appKey\`: \`${appKeyText}\``,
    '   - `preferLocal`: `true`',
    `3. **Initialize Enabled Modules:** Initialize only the WAP SDKs enabled for this application: \`${enabledSdkNames.join(', ')}\`.`,
  ];

  if (isAdsEnabled) {
    steps.push('4. **Initialize Ads:** Initialize `wap_ads_sdk` to fetch the effective remote configuration from `/api/platform/v1/ads/config`.');
  } else {
    steps.push('4. **Ads are disabled:** Do not initialize `wap_ads_sdk` or request ad units.');
  }

  if (isNotificationsEnabled) {
    steps.push('5. **Register Push Device:** Obtain device FCM token via `FirebaseMessaging` and register with WAPCentral (`/api/platform/v1/notifications/devices/register`).');
  } else {
    steps.push('5. **Notifications are disabled:** Skip device registration.');
  }

  steps.push('6. **No Secret Ingestion:** Do not fetch or store provider secrets in the client application.');
  steps.push('7. **No Local Duplicate State:** Do not create a local duplicate of WAPCentral business configuration.');
  steps.push('8. **Local-First Resilience:** Preserve local-first functionality if WAPCentral is temporarily unavailable.');

  return steps.join('\n');
}

/**
 * Generates an application-specific integration guide Markdown document using the canonical template.
 */
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

  const notificationsStatusStr = status.isNotificationsEnabled ? 'Enabled (FCM required)' : 'Disabled';

  const generatedDateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const fcmStatusStr = status.isNotificationsEnabled
    ? 'Required (Enabled for this application)'
    : 'Disabled for this application';

  // Section builders
  const sdkTableMd = buildSdkTable(app, status);
  const apiCatalogTableMd = buildApiCatalogTable(status);
  const adsSectionMd = buildAdsSection(app, status.isAdsEnabled);
  const notificationsSectionMd = buildNotificationsSection(status.isNotificationsEnabled);
  const startupSequenceSectionMd = buildStartupSequenceSection(
    app,
    status.enabledSdkNames,
    status.isAdsEnabled,
    status.isNotificationsEnabled,
    appKeyDisplay,
  );

  // Generate dynamic Dart SDK imports & initializers
  const sdkImports: string[] = [];
  const sdkInitStatements: string[] = [];

  if (status.isAdsEnabled) {
    sdkImports.push("import 'package:wap_ads_sdk/wap_ads_sdk.dart';");
    sdkInitStatements.push('  // 3. Initialize Ads (AppLovin MAX sole mediation)\n  await WapAdsCore.instance.initialize();');
  }
  if (status.isNotificationsEnabled) {
    sdkImports.push("import 'package:wap_notifications_sdk/wap_notifications_sdk.dart';");
    sdkInitStatements.push('  // 4. Initialize Notifications & Register FCM Token\n  await WapNotifications.instance.initialize();');
  }
  if (status.isAiEnabled) {
    sdkImports.push("import 'package:wap_ai_sdk/wap_ai_sdk.dart';");
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
    '{{ENABLED_SERVICES}}': enabledServicesStr,
    '{{ENABLED_SDKS_LIST}}': status.enabledSdkNames.join(', '),
    '{{ADS_STATUS}}': adsStatusStr,
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
    '{{NOTIFICATIONS_SECTION}}': notificationsSectionMd,
    '{{STARTUP_SEQUENCE_SECTION}}': startupSequenceSectionMd,
    '{{SDK_IMPORTS}}': sdkImports.length > 0 ? sdkImports.join('\n') : '',
    '{{SERVICE_INITIALIZATION}}': sdkInitStatements.length > 0 ? sdkInitStatements.join('\n\n') : '',
  };

  for (const [placeholder, val] of Object.entries(replacements)) {
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    markdown = markdown.replace(regex, val);
  }

  return markdown;
}
