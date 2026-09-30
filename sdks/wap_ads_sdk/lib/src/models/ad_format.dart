/// Supported ad formats across ad networks.
enum AdFormat {
  /// Standard banner advertisement (e.g. 320x50, 300x250, adaptive).
  banner,

  /// Full-screen interstitial advertisement displayed between screen transitions.
  interstitial,

  /// Full-screen rewarded video/playable ad granting in-app rewards.
  rewarded,

  /// Custom native advertisement styled to match app content.
  native,

  /// Rewarded interstitial combining interstitial placement with opt-in rewards.
  rewardedInterstitial;

  /// Human-readable display label.
  String get displayName {
    switch (this) {
      case AdFormat.banner:
        return 'Banner';
      case AdFormat.interstitial:
        return 'Interstitial';
      case AdFormat.rewarded:
        return 'Rewarded';
      case AdFormat.native:
        return 'Native';
      case AdFormat.rewardedInterstitial:
        return 'Rewarded Interstitial';
    }
  }

  /// Safely parses string into [AdFormat], defaulting to [AdFormat.banner].
  static AdFormat fromString(String? value) {
    if (value == null) return AdFormat.banner;
    switch (value.toLowerCase().replaceAll('-', '_').trim()) {
      case 'banner':
        return AdFormat.banner;
      case 'interstitial':
        return AdFormat.interstitial;
      case 'rewarded':
        return AdFormat.rewarded;
      case 'native':
        return AdFormat.native;
      case 'rewarded_interstitial':
      case 'rewardedinterstitial':
        return AdFormat.rewardedInterstitial;
      default:
        return AdFormat.banner;
    }
  }
}
