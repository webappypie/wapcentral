import 'package:flutter_test/flutter_test.dart';
import 'package:wap_ads_sdk/wap_ads.dart';
import 'package:wap_ads_sdk/src/core/frequency_manager.dart';

void main() {
  group('FrequencyManager & Cooldown Rules', () {
    late FrequencyManager frequencyManager;

    setUp(() {
      frequencyManager = FrequencyManager();
    });

    test('1. Enforces format cooldown seconds between impressions', () {
      const frequency = FormatFrequency(
        cooldownSeconds: 30,
        sessionCap: 10,
        dailyCap: 50,
      );

      // First check -> allowed
      final check1 = frequencyManager.canDisplay(
        format: AdFormat.interstitial,
        formatFrequency: frequency,
      );
      expect(check1.allowed, isTrue);

      // Record impression
      frequencyManager.recordDisplay(AdFormat.interstitial);

      // Immediate second check -> denied due to cooldown
      final check2 = frequencyManager.canDisplay(
        format: AdFormat.interstitial,
        formatFrequency: frequency,
      );
      expect(check2.allowed, isFalse);
      expect(check2.error?.code, AdError.cooldownActive);
      expect(check2.error?.message.contains('cooldown'), isTrue);
    });

    test('2. Enforces session cap limits', () {
      const frequency = FormatFrequency(
        cooldownSeconds: 0,
        sessionCap: 2,
        dailyCap: 10,
      );

      // Impression 1
      expect(frequencyManager.canDisplay(format: AdFormat.rewarded, formatFrequency: frequency).allowed, isTrue);
      frequencyManager.recordDisplay(AdFormat.rewarded);

      // Impression 2
      expect(frequencyManager.canDisplay(format: AdFormat.rewarded, formatFrequency: frequency).allowed, isTrue);
      frequencyManager.recordDisplay(AdFormat.rewarded);

      // Impression 3 -> Reaches session cap (2/2)
      final check3 = frequencyManager.canDisplay(format: AdFormat.rewarded, formatFrequency: frequency);
      expect(check3.allowed, isFalse);
      expect(check3.error?.code, AdError.frequencyCapped);
      expect(check3.error?.message.contains('session cap'), isTrue);
    });

    test('3. Enforces placement-specific caps and cooldowns independently', () {
      const placementConfig = PlacementConfig(
        placementKey: 'checkout_finish_interstitial',
        format: AdFormat.interstitial,
        enabled: true,
        cooldownSeconds: 60,
        sessionCap: 1,
        dailyCap: 5,
      );

      // First display for checkout placement
      expect(
        frequencyManager.canDisplay(
          format: AdFormat.interstitial,
          placementKey: 'checkout_finish_interstitial',
          placementConfig: placementConfig,
        ).allowed,
        isTrue,
      );
      frequencyManager.recordDisplay(AdFormat.interstitial, placementKey: 'checkout_finish_interstitial');

      // Subsequent display for checkout placement -> capped
      final check = frequencyManager.canDisplay(
        format: AdFormat.interstitial,
        placementKey: 'checkout_finish_interstitial',
        placementConfig: placementConfig,
      );
      expect(check.allowed, isFalse);

      // Different placement key has its own budget
      expect(
        frequencyManager.canDisplay(
          format: AdFormat.interstitial,
          placementKey: 'level_finish_interstitial',
          placementConfig: const PlacementConfig(
            placementKey: 'level_finish_interstitial',
            format: AdFormat.interstitial,
            enabled: true,
            cooldownSeconds: 0,
            sessionCap: 5,
          ),
        ).allowed,
        isTrue,
      );
    });

    test('4. App Open foreground background duration rule enforcement', () {
      // Rule: min_background_30s
      // Without backgrounding -> allowed on cold start
      expect(frequencyManager.canShowAppOpenOnForeground(rule: 'min_background_30s'), isTrue);

      // App entered background just now
      frequencyManager.recordAppBackgrounded();

      // Immediate foreground (<30s) -> blocked to prevent annoying user on quick switch
      expect(frequencyManager.canShowAppOpenOnForeground(rule: 'min_background_30s'), isFalse);

      // Rule 'always' -> allowed
      expect(frequencyManager.canShowAppOpenOnForeground(rule: 'always'), isTrue);

      // Rule 'disabled' -> blocked
      expect(frequencyManager.canShowAppOpenOnForeground(rule: 'disabled'), isFalse);
    });
  });
}
