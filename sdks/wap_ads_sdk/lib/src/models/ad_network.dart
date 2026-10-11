/// Supported advertising networks and platforms in WAPCentral.
enum AdNetwork {
  /// Google AdMob (demand source via MAX).
  admob,

  /// Meta Audience Network (social bidding demand source via MAX).
  meta,

  /// AppLovin MAX (mediation platform & direct AppLovin demand).
  applovin,

  /// InMobi (demand source via MAX adapter).
  inmobi,

  /// Unity Ads (demand source via MAX adapter).
  unity,

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
      case AdNetwork.inmobi:
        return 'InMobi';
      case AdNetwork.unity:
        return 'Unity Ads';
      case AdNetwork.wapads:
        return 'WebAppyPie Custom Ads';
    }
  }

  /// Whether this is WebAppyPie's first-party house promotion network.
  bool get isFirstParty => this == AdNetwork.wapads;

  /// Whether this provider is a mediation engine platform.
  bool get isMediationPlatform => this == AdNetwork.applovin;

  /// Whether this is a third-party demand source mediated through MAX.
  bool get isDemandSource =>
      this == AdNetwork.applovin ||
      this == AdNetwork.admob ||
      this == AdNetwork.meta ||
      this == AdNetwork.inmobi ||
      this == AdNetwork.unity;

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
      case 'inmobi':
        return AdNetwork.inmobi;
      case 'unity':
      case 'unity_ads':
      case 'unityads':
        return AdNetwork.unity;
      case 'wapads':
      case 'promo':
      case 'house':
      case 'custom_ads':
      case 'webappypie':
        return AdNetwork.wapads;
      default:
        return AdNetwork.admob;
    }
  }
}
