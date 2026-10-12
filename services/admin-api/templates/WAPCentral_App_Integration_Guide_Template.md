# WAPCentral Integration Guide — {{APP_NAME}}

> **Application:** {{APP_NAME}}  
> **Document Version:** 2.0 • WAPCentral 1.0  
> **Generated:** {{GENERATED_AT}}  
> **Source of Truth:** WAPCentral Central Control Plane & Firebase Console  

---

## Application Identity & Metadata

| Field | Configuration Value | Security & Source |
| :--- | :--- | :--- |
| **Application Name** | `{{APP_NAME}}` | WAPCentral Application Registry |
| **WAPCentral App ID** | `{{APP_ID}}` | Unique WAP Platform Identifier |
| **X-App-Key** | `{{APP_KEY}}` | Platform API Auth (`X-App-Key`) |
| **Android Package ID** | `{{ANDROID_PACKAGE_ID}}` | Android Manifest `package` |
| **iOS Bundle ID** | `{{IOS_BUNDLE_ID}}` | iOS `CFBundleIdentifier` |
| **Firebase Project ID** | `{{FIREBASE_PROJECT_ID}}` | Firebase Console (`projectId`) |
| **Firebase Android App ID** | `{{FIREBASE_ANDROID_APP_ID}}` | `google-services.json` (`mobilesdk_app_id`) |
| **Firebase iOS App ID** | `{{FIREBASE_IOS_APP_ID}}` | `GoogleService-Info.plist` (`GOOGLE_APP_ID`) |
| **Firebase Project Number / FCM Sender ID** | `{{FIREBASE_PROJECT_NUMBER}}` | Cloud Messaging Sender ID |
| **Enabled WAP Services** | `{{ENABLED_SERVICES}}` | Centrally Authorized Modules |
| **Ads Status** | `{{ADS_STATUS}}` | AppLovin MAX Mediation Engine |
| **Notifications Status** | `{{NOTIFICATIONS_STATUS}}` | WAPCentral FCM Dispatch Engine |

---

## 1. Purpose

This document is the official, app-specific implementation guide for **{{APP_NAME}}**. It is generated dynamically from the application's central registration in **WAPCentral** to eliminate manual configuration drift, guesswork, and security misconfigurations.

### Key Architecture Principles:
- **Local-First Architecture:** The mobile app retains full local functionality even if network connectivity is disrupted or WAPCentral is temporarily unreachable.
- **Central Control Plane:** WAPCentral serves as the single source of truth for platform service access, feature flags, Ads mediation, and Push Notification campaigns.
- **Lightweight Modular SDKs:** The application includes only the WAP client SDKs and provider adapters required for its active features.

---

## 2. App Configuration & Secure Credential Handling

| Parameter | Value | Description |
| :--- | :--- | :--- |
| **App Name** | `{{APP_NAME}}` | Display name of the application |
| **WAPCentral App ID** | `{{APP_ID}}` | Public application identifier passed in `X-App-Id` |
| **X-App-Key** | `{{APP_KEY}}` | Secret application key passed in `X-App-Key` |
| **Android Package ID** | `{{ANDROID_PACKAGE_ID}}` | Unique Android application ID |
| **iOS Bundle ID** | `{{IOS_BUNDLE_ID}}` | Unique Apple bundle identifier |
| **Firebase Project ID** | `{{FIREBASE_PROJECT_ID}}` | Target Firebase infrastructure project |
| **Firebase Android App ID** | `{{FIREBASE_ANDROID_APP_ID}}` | Mobile app client registration ID |
| **Firebase iOS App ID** | `{{FIREBASE_IOS_APP_ID}}` | iOS mobile app client registration ID |
| **FCM Sender ID** | `{{FIREBASE_PROJECT_NUMBER}}` | Authorized FCM project number |
| **Enabled WAP Services** | `{{ENABLED_SERVICES}}` | Active backend API modules |

### 🔒 Secure Credential-Handling Rules:
1. **Never Hardcode Secrets in Source Code:** Do not embed raw production API keys or service keys in Git repositories. Use `--dart-define` or Flutter secure storage.
2. **Direct Authentication Provisioning:** The complete, unmasked `X-App-Key` for {{APP_NAME}} is provided unmasked in this guide (`{{APP_KEY}}`). The AI development team can implement WAPCentral authentication directly without manual lookups or key replacements. If the key needs rotation, regenerate it anytime in **WAPCentral Dashboard → Applications → {{APP_NAME}} → Application Credentials**.
3. **Redact from Client Logs:** Ensure your HTTP logging interceptors automatically mask `X-App-Key` and authorization headers.
4. **No Third-Party Secrets:** Never include AI provider keys (OpenAI, Gemini, Anthropic) or FCM server service-account JSON inside the mobile app. All third-party access is mediated securely through WAPCentral backend services.

---

## 3. Firebase Configuration Files

Download the official configuration files directly from the Firebase Console for project `{{FIREBASE_PROJECT_ID}}`:

- **Android:** `google-services.json` → place at `android/app/google-services.json`
- **iOS:** `GoogleService-Info.plist` → place at `ios/Runner/GoogleService-Info.plist`

> [!WARNING]
> Firebase configuration files belong exclusively in your client project root. Never commit cloud service account private keys (`service-account.json`), database admin credentials, or backend signing keys into the mobile application repository.

---

## 4. Firebase Services

| Service | Status for {{APP_NAME}} | Integration Rule |
| :--- | :--- | :--- |
| **Firebase Cloud Messaging (FCM)** | `{{FCM_STATUS}}` | Required when WAPCentral Notifications are enabled |
| **Firebase Crashlytics** | `{{CRASHLYTICS_STATUS}}` | Recommended for real-time production crash reporting |
| **Firebase Analytics** | `{{ANALYTICS_STATUS}}` | Optional / Product-dependent |
| **Firebase Authentication** | `{{AUTH_STATUS}}` | Optional / Product-dependent (only if user login required) |
| **Cloud Firestore** | `Not required by WAPCentral` | Use only if the client application itself requires cloud persistence |
| **Cloud Storage** | `{{STORAGE_STATUS}}` | Optional / Product-dependent (only if app stores user files in cloud) |

---

## 5. Enabled WAP SDKs & Dependencies

Only add the WAP SDKs enabled for **{{APP_NAME}}** to your `pubspec.yaml`. Do not bundle unused SDKs.

{{SDK_TABLE}}

---

## 6. WAPCentral Connection & Initialization

The unified core client connects to the production WAPCentral API gateway:
- **Production Base URL:** `https://wapcentral-prod.web.app/api/platform/v1`

### Initialization Snippet (`lib/main.dart`):

```dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:wap_core_sdk/wap_core_sdk.dart';
{{SDK_IMPORTS}}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Initialize Firebase
  await Firebase.initializeApp();

  // 2. Initialize WAPCentral Core Client
  await WapCore.initialize(
    baseUrl: 'https://wapcentral-prod.web.app/api/platform/v1',
    appId: '{{APP_ID}}',
    appKey: const String.fromEnvironment('WAP_APP_KEY', defaultValue: '{{APP_KEY}}'),
    preferLocal: true,
  );

{{SERVICE_INITIALIZATION}}

  runApp(const MyApp());
}
```

Every platform request automatically attaches headers:
- `X-App-Id: {{APP_ID}}`
- `X-App-Key: {{APP_KEY}}`

---

## 7. Platform API Catalog & Permissions

The following table lists the WAPCentral Platform API endpoints and whether **{{APP_NAME}}** is authorized to access them:

{{API_CATALOG_TABLE}}

---

{{ADS_SECTION}}

---

{{NOTIFICATIONS_SECTION}}

---

{{STARTUP_SEQUENCE_SECTION}}

---

## 11. Project File Checklist

- [ ] `android/app/google-services.json` is present and matches package `{{ANDROID_PACKAGE_ID}}`
- [ ] `ios/Runner/GoogleService-Info.plist` is present and matches bundle `{{IOS_BUNDLE_ID}}`
- [ ] `pubspec.yaml` includes only the required WAP SDKs (`{{ENABLED_SDKS_LIST}}`)
- [ ] No hardcoded third-party API keys (OpenAI, Gemini, Anthropic, InMobi) in source code
- [ ] No WAPCentral `X-App-Key` printed to production device logs
- [ ] No hardcoded production Ad Unit IDs in Flutter code (fetched dynamically from `/api/platform/v1/ads/config`)
- [ ] No hardcoded push notification campaigns or device bypass endpoints in mobile code
- [ ] App permissions and entitlements scoped to minimum requirements

---

## 12. Security & Compliance Rules

1. **Transport Security:** All client-to-server traffic is strictly encrypted over TLS 1.3/HTTPS.
2. **Server-Side Enforcement:** Every request is authenticated by `X-App-Id` and `X-App-Key`. Unauthorized modules return `403 Forbidden`.
3. **Zero Secret Leakage:** Provider master credentials, FCM server keys, and AI models reside in Google Cloud Secret Manager.
4. **App Isolation:** Applications cannot inspect or invoke configurations, campaigns, or ad units belonging to other apps.
5. **No Client Mocking in Production:** Mobile apps must never manufacture fake third-party ads, fake impressions, or simulated metrics.

---

## 13. What NOT To Do (Common Pitfalls)

- ❌ **Do NOT bundle multiple mediation platforms:** Never include Unity LevelPlay alongside AppLovin MAX.
- ❌ **Do NOT bundle unneeded ad adapters:** Only include adapters for networks enabled in WAPCentral.
- ❌ **Do NOT hardcode Ad Unit IDs:** Always fetch effective ad configurations from `/api/platform/v1/ads/config`.
- ❌ **Do NOT place server secrets in mobile code:** Never store private FCM keys, service account JSON, or AI API tokens in Flutter.
- ❌ **Do NOT bypass WAPCentral:** Do not call external AI APIs directly when the corresponding WAP service is available.
- ❌ **Do NOT block app launch:** If WAPCentral is momentarily unreachable, fall back to local-first app functionality.

---

## 14. Release & Verification Checklist

- [ ] **Android Build:** App compiles with Android minSdk and targetSdk versions.
- [ ] **iOS Build:** App compiles with iOS deployment target and required privacy manifests.
- [ ] **Firebase Initialization:** Firebase initializes cleanly on cold start without crashes.
- [ ] **WAPCentral Health:** Cold-start check against `/api/platform/v1/health` succeeds.
- [ ] **Service Access:** Enabled services respond with 200 OK; disabled services return 403 Forbidden.
- [ ] **Ads Environment:** Testing mode shows official test ads; Production mode serves configured units.
- [ ] **Custom Ads House Fallback:** Verify house promo banner displays gracefully when third-party fill is 0.
- [ ] **FCM Device Registration:** Device registers token with `/api/platform/v1/notifications/devices/register`.
- [ ] **Log Audit:** Verify no credentials, tokens, or PII appear in `flutter logs` or Android logcat.

---

## 15. New App Setup — Short Workflow

1. **Register Application:** Add the app under WAPCentral Applications.
2. **Configure Modules:** Enable required services (AI, Ads, Notifications) on the app details page.
3. **Configure Ads:** Select Ad Strategy (Automatic Mediation vs Single Demand Source) and enable demand sources.
4. **Download Guide:** Download this `.md` integration guide from Developer Resources.
5. **Add Dependencies:** Add only the required WAP SDKs to `pubspec.yaml`.
6. **Initialize Client:** Add initialization snippet to `lib/main.dart` with secure credential handling.
7. **Verify & Release:** Run the release checklist before publishing to Google Play / App Store.

---

## 16. Source of Truth

This integration guide is generated dynamically for **{{APP_NAME}}** (`{{APP_ID}}`). WAPCentral remains the authoritative source of truth for platform identity, Ads mediation, notification rules, and service access. Firebase remains the source of truth for mobile push credentials and analytics.

*Generated by WAPCentral • {{APP_NAME}} • {{APP_ID}}*
