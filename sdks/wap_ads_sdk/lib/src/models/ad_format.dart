/// Supported ad formats across ad networks.
enum AdFormat {
  /// Standard banner advertisement (e.g. 320x50, 300x250, adaptive).
  banner,

  /// Custom native advertisement styled to match app content.
  native,

  /// Full-screen interstitial advertisement displayed between screen transitions.
  interstitial,

  /// Full-screen rewarded video/playable ad granting in-app rewards.
  rewarded,

  /// Full-screen ad displayed upon app launch or returning from background.
  appOpen,

  /// Rewarded interstitial combining interstitial placement with opt-in rewards.
  rewardedInterstitial;

  /// Human-readable display label.
  String get displayName {
    switch (this) {
      case AdFormat.banner:
        return 'Banner';
      case AdFormat.native:
        return 'Native';
      case AdFormat.interstitial:
        return 'Interstitial';
      case AdFormat.rewarded:
        return 'Rewarded';
      case AdFormat.appOpen:
        return 'App Open';
      case AdFormat.rewardedInterstitial:
        return 'Rewarded Interstitial';
    }
  }

  /// Platform string representation used in WAPCentral API schemas.
  String get apiValue {
    switch (this) {
      case AdFormat.banner:
        return 'banner';
      case AdFormat.native:
        return 'native';
      case AdFormat.interstitial:
        return 'interstitial';
      case AdFormat.rewarded:
        return 'rewarded';
      case AdFormat.appOpen:
        return 'app_open';
      case AdFormat.rewardedInterstitial:
        return 'rewarded_interstitial';
    }
  }

  /// Safely parses string into [AdFormat], defaulting to [AdFormat.banner].
  static AdFormat fromString(String? value) {
    if (value == null) return AdFormat.banner;
    switch (value.toLowerCase().replaceAll('-', '_').trim()) {
      case 'banner':
        return AdFormat.banner;
      case 'native':
        return AdFormat.native;
      case 'interstitial':
        return AdFormat.interstitial;
      case 'rewarded':
        return AdFormat.rewarded;
      case 'app_open':
      case 'appopen':
        return AdFormat.appOpen;
      case 'rewarded_interstitial':
      case 'rewardedinterstitial':
        return AdFormat.rewardedInterstitial;
      default:
        return AdFormat.banner;
    }
  }
}
