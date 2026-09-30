/// Supported advertising networks and platforms in WAPCentral.
enum AdNetwork {
  /// Google AdMob (primary ad network).
  admob,

  /// Meta Audience Network (secondary ad network / social demand).
  meta,

  /// AppLovin MAX (mediation platform).
  applovin,

  /// WAPAds (first-party cross-app promotion network / house ads).
  wapads;

  /// Human-readable display label.
  String get displayName {
    switch (this) {
      case AdNetwork.admob:
        return 'Google AdMob';
      case AdNetwork.meta:
        return 'Meta Audience Network';
      case AdNetwork.applovin:
        return 'AppLovin MAX';
      case AdNetwork.wapads:
        return 'WAPAds (House Ads)';
    }
  }

  /// Whether this is WebAppyPie's first-party house promotion network.
  bool get isFirstParty => this == AdNetwork.wapads;

  /// Whether this provider is a mediation wrapper platform.
  bool get isMediationPlatform => this == AdNetwork.applovin;

  /// Safely parses string into [AdNetwork], defaulting to [AdNetwork.admob].
  static AdNetwork fromString(String? value) {
    if (value == null) return AdNetwork.admob;
    switch (value.toLowerCase().trim()) {
      case 'admob':
      case 'google':
      case 'google_admob':
        return AdNetwork.admob;
      case 'meta':
      case 'facebook':
      case 'meta_audience_network':
        return AdNetwork.meta;
      case 'applovin':
      case 'max':
      case 'applovin_max':
        return AdNetwork.applovin;
      case 'wapads':
      case 'promo':
      case 'house':
      case 'webappypie':
        return AdNetwork.wapads;
      default:
        return AdNetwork.admob;
    }
  }
}
