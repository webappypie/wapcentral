import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PizZip from 'pizzip';
import type { App, AppModule, PlatformServiceType } from '@wapcentral/types';

/**
 * Escapes special XML characters to prevent OpenXML syntax corruption.
 */
export function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a clean, sanitized filesystem-safe filename for the application integration guide.
 * Example:
 *   "FileZen" -> "WAPCentral_FileZen_Integration_Guide.docx"
 *   "OptiLens AI" -> "WAPCentral_OptiLens_AI_Integration_Guide.docx"
 */
export function getIntegrationGuideFilename(appName: string): string {
  const raw = appName || 'App';
  // Extract primary name before subtitle dashes if present
  const baseName = raw.split(/[\u2014\u2013-]/)[0]?.trim() || raw;
  const safeName = baseName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  return `WAPCentral_${safeName || 'App'}_Integration_Guide.docx`;
}

/**
 * Resolves the location of the common master template docx file.
 */
export function resolveTemplatePath(): string {
  const candidatePaths: string[] = [
    path.resolve(process.cwd(), 'templates/WAPCentral_App_Integration_Guide_Template_v4.docx'),
    path.resolve(process.cwd(), 'services/admin-api/templates/WAPCentral_App_Integration_Guide_Template_v4.docx'),
    path.resolve(process.cwd(), '../admin-api/templates/WAPCentral_App_Integration_Guide_Template_v4.docx'),
  ];

  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    candidatePaths.push(
      path.resolve(currentDir, '../../templates/WAPCentral_App_Integration_Guide_Template_v4.docx'),
      path.resolve(currentDir, '../templates/WAPCentral_App_Integration_Guide_Template_v4.docx'),
      path.resolve(currentDir, './templates/WAPCentral_App_Integration_Guide_Template_v4.docx'),
      path.resolve(currentDir, '../../services/admin-api/templates/WAPCentral_App_Integration_Guide_Template_v4.docx'),
      path.resolve(currentDir, '../services/admin-api/templates/WAPCentral_App_Integration_Guide_Template_v4.docx'),
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

function makeHeading1(title: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escapeXml(title)}</w:t></w:r></w:p>`;
}

function makeHeading2(title: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>${escapeXml(title)}</w:t></w:r></w:p>`;
}

function makeParagraph(text: string, isBold = false): string {
  const rPr = isBold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `<w:p><w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function makeBullet(text: string, boldPrefix?: string): string {
  if (boldPrefix) {
    return `<w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(boldPrefix)} </w:t></w:r><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
  }
  return `<w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

/**
 * Builds the application-specific Section 8 (Ads).
 */
function buildAdsSection(app: App, isAdsEnabled: boolean): string {
  const pieces: string[] = [];
  pieces.push(makeHeading1('8. Ads — Controlled by WAPCentral'));

  if (isAdsEnabled) {
    const simple = app.simpleAdsConfig;
    const env =
      simple?.environment === 'testing'
        ? 'Testing'
        : app.environment === 'production'
          ? 'Production'
          : 'Testing';

    pieces.push(
      makeParagraph(
        'This app uses AppLovin MAX as the sole advertising mediation platform. WAPCentral centrally controls Ads Enabled/Disabled, Ad Strategy, Testing/Production mode, enabled demand sources, enabled formats, and production identifiers for this app. Do not bundle multiple mediation platforms (such as Unity LevelPlay) or duplicate direct SDKs.',
      ),
    );
    pieces.push(makeBullet('Enabled', 'Ads:'));
    pieces.push(makeBullet('AppLovin MAX (Sole Mediation Platform)', 'Mediation Engine:'));

    // Strategy
    const strategy = simple?.strategy === 'single_source' ? 'Single Demand Source' : 'Automatic Mediation';
    pieces.push(
      makeBullet(
        `${strategy}${simple?.strategy === 'single_source' && simple.singleSourceNetwork ? ` (${simple.singleSourceNetwork} routed through MAX)` : ''}`,
        'Ad Strategy:',
      ),
    );
    pieces.push(makeBullet(env, 'Environment:'));

    // Demand sources
    const netList: string[] = [];
    if (simple?.networks?.applovin ?? true) netList.push('AppLovin Demand (Built-in)');
    if (simple?.networks?.admob) netList.push('Google AdMob (MAX Adapter)');
    if (simple?.networks?.meta) netList.push('Meta Audience Network (MAX Adapter)');
    if (simple?.networks?.inmobi) netList.push('InMobi (MAX Adapter)');
    if (simple?.networks?.unity) netList.push('Unity Ads (MAX Adapter)');
    if (simple?.networks?.wapCustomAds ?? true) netList.push('WebAppyPie Custom Ads (House Ads Fallback)');

    pieces.push(
      makeBullet(
        netList.join(', ') || 'AppLovin Demand, Google AdMob, WebAppyPie Custom Ads',
        'Enabled Demand Sources:',
      ),
    );

    // Required SDKs & Adapters for this build
    pieces.push(makeHeading2('Required Dependencies & Adapters for this App'));
    pieces.push(makeBullet('wap_ads_sdk (WebAppyPie Unified Ads Client)'));
    pieces.push(makeBullet('applovin_max (AppLovin MAX Flutter SDK / Core Mediation Engine)'));
    if (simple?.networks?.admob) {
      pieces.push(makeBullet('Google AdMob Mediation Adapter for AppLovin MAX'));
    }
    if (simple?.networks?.meta) {
      pieces.push(makeBullet('Meta Audience Network Mediation Adapter for AppLovin MAX'));
    }
    if (simple?.networks?.inmobi) {
      pieces.push(makeBullet('InMobi Mediation Adapter for AppLovin MAX'));
    }
    if (simple?.networks?.unity) {
      pieces.push(makeBullet('Unity Ads Mediation Adapter for AppLovin MAX'));
    }

    // Formats
    const banner = simple?.enabledFormats?.banner ?? true ? 'Banner' : null;
    const native = simple?.enabledFormats?.native ?? true ? 'Native' : null;
    const interstitial = simple?.enabledFormats?.interstitial ?? true ? 'Interstitial' : null;
    const rewarded = simple?.enabledFormats?.rewarded ?? true ? 'Rewarded' : null;
    const appOpen = simple?.enabledFormats?.appOpen ?? true ? 'App Open' : null;
    const rewardedInterstitial = simple?.enabledFormats?.rewardedInterstitial ? 'Rewarded Interstitial' : null;
    const formats = [banner, native, interstitial, rewarded, appOpen, rewardedInterstitial].filter(Boolean);
    pieces.push(makeBullet(formats.join(', ') || 'Banner, Native, Interstitial, Rewarded, App Open', 'Supported Formats:'));

    // Prerequisites & Setup
    pieces.push(makeHeading2('Provider Prerequisites & Configuration'));
    pieces.push(makeBullet('AppLovin SDK Key configured in AndroidManifest.xml and Info.plist (AppLovinSdkKey).', 'AppLovin MAX:'));
    if (simple?.networks?.admob) {
      const admobAppId = simple.networkConfig?.admob?.appId || (env === 'Testing' ? 'ca-app-pub-3940256099942544~3347511713' : 'Not configured');
      pieces.push(makeBullet(`Google Mobile Ads App ID (${admobAppId}) declared in AndroidManifest.xml and Info.plist (GADApplicationIdentifier).`, 'Google AdMob:'));
    }
    if (simple?.networks?.meta) {
      pieces.push(makeBullet('Meta Audience Network account verified with app-ads.txt.', 'Meta Audience:'));
    }
    if (simple?.networks?.inmobi) {
      pieces.push(makeBullet('InMobi Account ID and property approved in InMobi console.', 'InMobi:'));
    }
    if (simple?.networks?.unity) {
      pieces.push(makeBullet('Unity Game ID registered in Unity Dashboard.', 'Unity Ads:'));
    }

    // Testing vs Production
    pieces.push(makeHeading2('Testing & Release Verification'));
    if (env === 'Testing') {
      pieces.push(makeBullet('Testing Mode is ACTIVE. Official SDK test ads and sandbox unit IDs are automatically injected by WAPCentral. No dummy banners or simulated placeholders are used.'));
    } else {
      pieces.push(makeBullet('Production Mode is ACTIVE. Genuine provider-reported impressions and auction bids are used. Any missing ad units will show Not configured and will be cleanly omitted.'));
    }
    pieces.push(
      makeBullet(
        'Testing configuration is controlled centrally by WAPCentral. The mobile app must not hardcode fake production IDs.',
      ),
    );
    pieces.push(makeBullet('wap_ads_sdk fetches the effective configuration from /api/platform/v1/ads/config.'));
    pieces.push(makeBullet('Disabled networks and formats must not be requested by client code.'));
    pieces.push(makeBullet('No fake impressions, revenue, eCPM or fill-rate values.'));
    pieces.push(makeBullet('No-fill and network failure handling: WebAppyPie Custom Ads automatically display as high-fill house promotional fallback when third-party demand is exhausted.'));
  } else {
    pieces.push(makeParagraph('Ads: Disabled for this application.'));
    pieces.push(makeBullet('Do not install wap_ads_sdk or initialize ad networks for this application.'));
    pieces.push(makeBullet('Do not create local ad views or configure ad units in mobile client code.'));
  }

  return pieces.join('');
}

/**
 * Builds the application-specific Section 9 (Notifications).
 */
function buildNotificationsSection(isNotificationsEnabled: boolean): string {
  const pieces: string[] = [];
  pieces.push(makeHeading1('9. Notifications — Controlled by WAPCentral'));

  if (isNotificationsEnabled) {
    pieces.push(
      makeParagraph(
        'Notifications are managed centrally from WAPCentral for this app. The mobile app does not contain its own campaign management system.',
      ),
    );
    pieces.push(makeBullet('Enabled', 'Notifications:'));
    pieces.push(makeBullet('Required (FCM configuration via google-services.json / GoogleService-Info.plist)', 'FCM:'));
    pieces.push(makeBullet('Required', 'wap_notifications_sdk:'));
    pieces.push(makeBullet('WAPCentral (/api/platform/v1/notifications/devices/register)', 'Device registration:'));
    pieces.push(makeBullet('WAPCentral (/api/platform/v1/notifications)', 'Notification feed:'));
    pieces.push(
      makeBullet(
        'Initialize wap_notifications_sdk with the WAPCentral app credentials and the device FCM token.',
      ),
    );
    pieces.push(makeBullet('Register the device with WAPCentral upon successful token acquisition.'));
    pieces.push(makeBullet('Read the app-specific notification feed and synchronize unread/read state.'));
    pieces.push(
      makeBullet(
        'WAPCentral sends title, message body, optional rich image, and optional deep link payload.',
      ),
    );
    pieces.push(makeBullet('WAPCentral supports Send Now / Schedule according to dashboard capabilities.'));
    pieces.push(makeBullet('Never place FCM server or service-account private credentials in the mobile app.'));
  } else {
    pieces.push(makeParagraph('Notifications: Disabled for this application.'));
    pieces.push(
      makeBullet(
        'Do not install wap_notifications_sdk or configure notification device registration for this application.',
      ),
    );
    pieces.push(makeBullet('No push notification handling or campaign polling is required.'));
  }

  return pieces.join('');
}

/**
 * Builds the application-specific Section 10 (App Startup Sequence).
 */
function buildStartupSequenceSection(
  app: App,
  enabledSdkNames: string[],
  isAdsEnabled: boolean,
  isNotificationsEnabled: boolean,
  appKeyText: string,
): string {
  const pieces: string[] = [];
  pieces.push(makeHeading1('10. App Startup Sequence'));
  pieces.push(
    makeParagraph('1. Initialize Firebase using standard Flutter Firebase setup (Firebase.initializeApp()).'),
  );
  pieces.push(makeParagraph('2. Initialize wap_core_sdk with the generated App ID and X-App-Key:'));
  pieces.push(makeBullet('https://wapcentral-prod.web.app/api/platform/v1', '   baseUrl:'));
  pieces.push(makeBullet(app.id, '   appId:'));
  pieces.push(makeBullet(appKeyText, '   appKey:'));
  pieces.push(makeBullet('true', '   preferLocal:'));
  pieces.push(
    makeParagraph(
      `3. Initialize only the WAP SDKs enabled for this application: ${enabledSdkNames.join(', ')}.`,
    ),
  );

  if (isAdsEnabled) {
    pieces.push(
      makeParagraph(
        '4. Initialize wap_ads_sdk to fetch the effective remote configuration from /api/platform/v1/ads/config.',
      ),
    );
  } else {
    pieces.push(makeParagraph('4. Ads are disabled: do not initialize wap_ads_sdk or request ad units.'));
  }

  if (isNotificationsEnabled) {
    pieces.push(
      makeParagraph(
        '5. Obtain device FCM token via FirebaseMessaging and register with WAPCentral (/api/platform/v1/notifications/devices/register).',
      ),
    );
  } else {
    pieces.push(makeParagraph('5. Notifications are disabled: skip device registration.'));
  }

  pieces.push(makeParagraph('6. Do not fetch or store provider secrets in the client application.'));
  pieces.push(makeParagraph('7. Do not create a local duplicate of WAPCentral business configuration.'));
  pieces.push(
    makeParagraph('8. Preserve local-first functionality if WAPCentral is temporarily unavailable.'),
  );

  return pieces.join('');
}

/**
 * Filters and styles Table 3 (SDK table) to include only the enabled SDKs for this application.
 */
function customizeSdkTable(tableXml: string, app: App, status: AppServiceStatus): string {
  const rows = tableXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
  if (rows.length < 2) return tableXml;

  const headerRow = rows[0]!;
  const keptRows: string[] = [headerRow];

  const sdkMap: Record<string, { enabled: boolean; rowIdx: number }> = {
    wap_core_sdk: { enabled: true, rowIdx: 1 },
    wap_ai_sdk: { enabled: status.isAiEnabled, rowIdx: 2 },
    wap_image_sdk: { enabled: status.isImageEnabled, rowIdx: 3 },
    wap_ocr_sdk: { enabled: status.isOcrEnabled, rowIdx: 4 },
    wap_file_sdk: { enabled: status.isFilesEnabled, rowIdx: 5 },
    wap_ads_sdk: { enabled: status.isAdsEnabled, rowIdx: 6 },
    wap_notifications_sdk: { enabled: status.isNotificationsEnabled, rowIdx: 7 },
    wap_promo_sdk: { enabled: status.isPromoEnabled, rowIdx: 8 },
  };

  for (const [sdkName, config] of Object.entries(sdkMap)) {
    if (config.enabled && rows[config.rowIdx]) {
      let row = rows[config.rowIdx]!;
      // Update include-when column with clear affirmative badge
      const badge =
        sdkName === 'wap_core_sdk'
          ? '✓ Required (Core WAP runtime &amp; auth)'
          : `✓ Required (Enabled for ${escapeXml(app.name)})`;
      row = row.replace(
        /<w:t>[^<]*<\/w:t>(<\/w:r><\/w:p><\/w:tc><\/w:tr>)/,
        `<w:t>${badge}</w:t>$1`,
      );
      keptRows.push(row);
    }
  }

  const tableHeaderMatch = tableXml.match(/^<w:tbl[\s\S]*?<w:tblGrid[\s\S]*?<\/w:tblGrid>/);
  const tablePrefix = tableHeaderMatch ? tableHeaderMatch[0] : '<w:tbl>';
  return `${tablePrefix}${keptRows.join('')}</w:tbl>`;
}

/**
 * Customizes Table 4 (Platform API Catalog) with per-app enablement indicators.
 */
function customizeApiCatalogTable(tableXml: string, status: AppServiceStatus): string {
  const rows = tableXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
  if (rows.length < 2) return tableXml;

  const headerRow = rows[0]!;
  const updatedRows: string[] = [headerRow];

  for (let i = 1; i < rows.length; i++) {
    let row = rows[i]!;
    if (row.includes('/api/platform/v1/health')) {
      row = row.replace(/<w:t>Public<\/w:t>/, '<w:t>Public (Available)</w:t>');
    } else if (row.includes('/api/platform/v1/ai/')) {
      const state = status.isAiEnabled ? 'ai — Enabled' : 'ai — Not enabled for this app';
      row = row.replace(/<w:t>ai<\/w:t>/, `<w:t>${escapeXml(state)}</w:t>`);
    } else if (row.includes('/api/platform/v1/image/')) {
      const state = status.isImageEnabled ? 'image — Enabled' : 'image — Not enabled for this app';
      row = row.replace(/<w:t>image<\/w:t>/, `<w:t>${escapeXml(state)}</w:t>`);
    } else if (row.includes('/api/platform/v1/ocr/')) {
      const state = status.isOcrEnabled ? 'ocr — Enabled' : 'ocr — Not enabled for this app';
      row = row.replace(/<w:t>ocr<\/w:t>/, `<w:t>${escapeXml(state)}</w:t>`);
    } else if (row.includes('/api/platform/v1/files/')) {
      const state = status.isFilesEnabled ? 'files — Enabled' : 'files — Not enabled for this app';
      row = row.replace(/<w:t>files<\/w:t>/, `<w:t>${escapeXml(state)}</w:t>`);
    } else if (row.includes('/api/platform/v1/ads/')) {
      const state = status.isAdsEnabled ? 'ads — Enabled' : 'ads — Not enabled for this app';
      row = row.replace(/<w:t>ads<\/w:t>/, `<w:t>${escapeXml(state)}</w:t>`);
    } else if (row.includes('/api/platform/v1/notifications/')) {
      const state = status.isNotificationsEnabled
        ? 'notifications — Enabled'
        : 'notifications — Not enabled for this app';
      row = row.replace(/<w:t>notifications<\/w:t>/, `<w:t>${escapeXml(state)}</w:t>`);
    }
    updatedRows.push(row);
  }

  const tableHeaderMatch = tableXml.match(/^<w:tbl[\s\S]*?<w:tblGrid[\s\S]*?<\/w:tblGrid>/);
  const tablePrefix = tableHeaderMatch ? tableHeaderMatch[0] : '<w:tbl>';
  return `${tablePrefix}${updatedRows.join('')}</w:tbl>`;
}

/**
 * Generates an application-specific integration guide DOCX document using the single master template.
 */
export async function generateIntegrationGuide(app: App): Promise<Buffer> {
  const templatePath = resolveTemplatePath();
  const templateBinary = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(templateBinary);

  let xml = zip.file('word/document.xml')?.asText();
  if (!xml) {
    throw new Error('Invalid template: word/document.xml is missing.');
  }

  const status = analyzeAppServices(app);

  // Fallback string for non-stored Firebase fields
  const NOT_STORED_FIREBASE = 'Configured in Firebase — not stored in WAPCentral';

  const appKeyDisplay = app.appKey?.trim() ? app.appKey.trim() : '<COPY_FROM_APPLICATION_CREDENTIALS>';
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

  // 1. Substitute placeholders across document
  const replacements: Record<string, string> = {
    '{{APP_NAME}}': escapeXml(app.name),
    '{{APP_ID}}': escapeXml(app.id),
    '{{APP_KEY}}': escapeXml(appKeyDisplay),
    '{{ANDROID_PACKAGE_ID}}': escapeXml(androidPkg),
    '{{IOS_BUNDLE_ID}}': escapeXml(iosBundle),
    '{{FIREBASE_PROJECT_ID}}': escapeXml(fbProjectId),
    '{{FIREBASE_ANDROID_APP_ID}}': escapeXml(fbAndroidAppId),
    '{{FIREBASE_IOS_APP_ID}}': escapeXml(fbIosAppId),
    '{{FIREBASE_PROJECT_NUMBER}}': escapeXml(fcmSenderId),
    '{{ENABLED_SERVICES}}': escapeXml(enabledServicesStr),
    '{{ADS_STATUS}}': escapeXml(adsStatusStr),
    '{{NOTIFICATIONS_STATUS}}': escapeXml(notificationsStatusStr),
    '{{GENERATED_AT}}': escapeXml(generatedDateStr),
    '{{FCM_STATUS}}': escapeXml(fcmStatusStr),
    '{{CRASHLYTICS_STATUS}}': 'Recommended for production crash monitoring',
    '{{ANALYTICS_STATUS}}': 'Optional / Product-dependent',
    '{{AUTH_STATUS}}': 'Optional / Product-dependent',
    '{{STORAGE_STATUS}}': 'Optional / Product-dependent',
  };

  for (const [placeholder, val] of Object.entries(replacements)) {
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    xml = xml.replace(regex, val);
  }

  // 2. Customize Table 3 (SDK table)
  const tables = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  if (tables[3]) {
    const originalTable3 = tables[3];
    const customizedTable3 = customizeSdkTable(originalTable3, app, status);
    xml = xml.replace(originalTable3, () => customizedTable3);
  }

  // 3. Customize Table 4 (Platform API catalog)
  // Re-match tables in modified xml
  const tablesAfterSdk = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  if (tablesAfterSdk[4]) {
    const originalTable4 = tablesAfterSdk[4];
    const customizedTable4 = customizeApiCatalogTable(originalTable4, status);
    xml = xml.replace(originalTable4, () => customizedTable4);
  }

  // 4. Update Section 6 (WAPCentral Connection) with real connection values
  xml = xml.replace(
    /<w:t>baseUrl = the production WAPCentral base URL<\/w:t>/g,
    `<w:t>baseUrl = 'https://wapcentral-prod.web.app/api/platform/v1'</w:t>`,
  );
  xml = xml.replace(
    /<w:t>appId = the WAPCentral App ID above<\/w:t>/g,
    `<w:t>appId = '${escapeXml(app.id)}'</w:t>`,
  );
  xml = xml.replace(
    /<w:t>appKey = the WAPCentral X-App-Key above<\/w:t>/g,
    `<w:t>appKey = '${escapeXml(appKeyDisplay)}'</w:t>`,
  );

  // 5. Replace Section 8 (Ads), Section 9 (Notifications), Section 10 (Startup sequence)
  const s8HeaderMatch = xml.match(
    /<w:p(?: [^>]*)?>(?:(?!<\/w:p>)[\s\S])*?8\.\s*Ads[\s\S]*?<\/w:p>/,
  );
  const s11HeaderMatch = xml.match(
    /<w:p(?: [^>]*)?>(?:(?!<\/w:p>)[\s\S])*?11\.\s*Project[\s\S]*?<\/w:p>/,
  );

  if (s8HeaderMatch && s11HeaderMatch) {
    const startIdx = xml.indexOf(s8HeaderMatch[0]);
    const endIdx = xml.indexOf(s11HeaderMatch[0]);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const dynamicSectionsXml =
        buildAdsSection(app, status.isAdsEnabled) +
        buildNotificationsSection(status.isNotificationsEnabled) +
        buildStartupSequenceSection(app, status.enabledSdkNames, status.isAdsEnabled, status.isNotificationsEnabled, appKeyDisplay);

      xml = xml.substring(0, startIdx) + dynamicSectionsXml + xml.substring(endIdx);
    }
  }

  zip.file('word/document.xml', xml);
  const buffer = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });

  return buffer;
}
