import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
 * Masks sensitive secret keys for secure documentation output.
 * Preserves identifier prefix and suffix when appropriate while masking secret contents.
 */
export function maskSecretValue(secret?: string): string {
  if (!secret || secret.trim() === '' || secret === 'Not configured') {
    return 'Not configured';
  }
  const trimmed = secret.trim();
  if (trimmed.startsWith('wap_key_')) {
    const suffix = trimmed.length > 12 ? trimmed.slice(-4) : '••••';
    return `wap_key_••••••••${suffix} (Masked for security — copy full key in WAPCentral Dashboard → Application Credentials)`;
  }
  return '•••••••••••••••• (Masked for security — configure securely in environment)';
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
  const prereqs: string[] = [
    '- **AppLovin MAX:** AppLovin SDK Key configured in `AndroidManifest.xml` and `Info.plist` (`AppLovinSdkKey`).',
  ];
  if (simple?.networks?.admob) {
    const admobAppId = simple.networkConfig?.admob?.appId || (env === 'Testing' ? 'ca-app-pub-3940256099942544~3347511713' : 'Not configured');
    prereqs.push(`- **Google AdMob:** Google Mobile Ads App ID (\`${admobAppId}\`) declared in \`AndroidManifest.xml\` and \`Info.plist\` (\`GADApplicationIdentifier\`).`);
  }
  if (simple?.networks?.meta) {
    prereqs.push('- **Meta Audience Network:** Account verified with `app-ads.txt` and audience placement registered in Meta Business Suite.');
  }
  if (simple?.networks?.inmobi) {
    prereqs.push('- **InMobi:** InMobi Account ID and property approved in InMobi console.');
  }
  if (simple?.networks?.unity) {
    prereqs.push('- **Unity Ads:** Unity Game ID registered in Unity Dashboard.');
  }

  // Testing vs Production verification text
  const verificationText =
    env === 'Testing'
      ? '- **Testing Mode is ACTIVE:** Official SDK test ads and sandbox unit IDs are automatically injected by WAPCentral. No dummy banners or simulated placeholders are used.'
      : '- **Production Mode is ACTIVE:** Genuine provider-reported impressions and auction bids are used. Any missing ad units will show `Not configured` and will be cleanly omitted.';

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
    '### Testing & Release Verification:',
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

  // Fallback string for non-stored Firebase fields
  const NOT_STORED_FIREBASE = 'Configured in Firebase — not stored in WAPCentral';

  // Securely masked app key for documentation
  const appKeyDisplay = app.appKey?.trim()
    ? maskSecretValue(app.appKey.trim())
    : 'Not configured (Generate in WAPCentral Dashboard → Application Credentials)';

  const androidPkg = app.packageId?.trim() ? app.packageId.trim() : 'Not configured';
  const iosBundle = app.bundleId?.trim() ? app.bundleId.trim() : 'Not configured';

  const fbProjectId = app.firebaseProjectId?.trim() ? app.firebaseProjectId.trim() : NOT_STORED_FIREBASE;
  const fbAndroidAppId = app.firebaseAndroidAppId?.trim()
    ? app.firebaseAndroidAppId.trim()
    : NOT_STORED_FIREBASE;
  const fbIosAppId = app.firebaseIosAppId?.trim() ? app.firebaseIosAppId.trim() : NOT_STORED_FIREBASE;
  const fcmSenderId = app.fcmSenderId?.trim() ? app.fcmSenderId.trim() : NOT_STORED_FIREBASE;

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
    '{{APP_KEY_DART_DEFAULT}}': app.appKey?.trim() ? '••••••••' : '',
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
