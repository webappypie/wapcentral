import { describe, it, expect } from 'vitest';
import {
  PLATFORM_SERVICES_CATALOG,
  PLATFORM_ENDPOINTS_CATALOG,
  PLATFORM_SDKS_CATALOG,
  subscribeKillSwitches,
  toggleKillSwitch,
  fetchPlatformUsageMetrics,
} from './platformService.js';

describe('platformService', () => {
  it('provides the complete platform services catalog', () => {
    expect(PLATFORM_SERVICES_CATALOG.length).toBeGreaterThanOrEqual(4);
    const serviceIds = PLATFORM_SERVICES_CATALOG.map((s) => s.id);
    expect(serviceIds).toContain('ai');
    expect(serviceIds).toContain('image');
    expect(serviceIds).toContain('ocr');
    expect(serviceIds).toContain('files');
  });

  it('provides the complete platform endpoints catalog', () => {
    expect(PLATFORM_ENDPOINTS_CATALOG.length).toBeGreaterThanOrEqual(10);
    const paths = PLATFORM_ENDPOINTS_CATALOG.map((e) => e.path);
    expect(paths).toContain('/api/platform/v1/ai/generate');
    expect(paths).toContain('/api/platform/v1/image/enhance');
    expect(paths).toContain('/api/platform/v1/ocr/extract');
    expect(paths).toContain('/api/platform/v1/files/search');
    expect(paths).toContain('/api/platform/v1/health');
  });

  it('provides the complete platform SDKs catalog', () => {
    expect(PLATFORM_SDKS_CATALOG.length).toBe(8);
    const sdkIds = PLATFORM_SDKS_CATALOG.map((s) => s.id);
    expect(sdkIds).toEqual([
      'wap_core_sdk',
      'wap_ai_sdk',
      'wap_image_sdk',
      'wap_ocr_sdk',
      'wap_file_sdk',
      'wap_ads_sdk',
      'wap_notifications_sdk',
      'wap_promo_sdk',
    ]);
  });

  it('handles kill switch toggling correctly', async () => {
    let capturedState: any = null;
    const unsub = subscribeKillSwitches((state) => {
      capturedState = state;
    });

    expect(capturedState).toBeDefined();
    expect(capturedState.global).toBe(false);

    const toggled = await toggleKillSwitch('global');
    expect(toggled.global).toBe(true);

    const serviceToggled = await toggleKillSwitch('services', 'ocr');
    expect(serviceToggled.services.ocr).toBe(true);

    // Reset back
    await toggleKillSwitch('global', undefined, false);
    await toggleKillSwitch('services', 'ocr', false);

    unsub();
  });

  it('fetches platform usage metrics', async () => {
    const metrics = await fetchPlatformUsageMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.totalRequests).toBeGreaterThan(0);
    expect(metrics.perServiceBreakdown.ai).toBeDefined();
    expect(metrics.perAppBreakdown.filezen).toBeDefined();
  });
});
