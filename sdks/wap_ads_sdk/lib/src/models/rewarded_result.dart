import 'ad_error.dart';

/// Structured result returned after presenting a rewarded or rewarded-interstitial ad.
class RewardedAdResult {
  /// Whether the ad displayed and finished without crashing or unexpected closing.
  final bool success;

  /// Whether the user completed the required view/action and earned the reward.
  final bool rewardGranted;

  /// The type/currency of reward configured for the placement (e.g. 'gems', 'coins', 'pro_credits').
  final String rewardType;

  /// The numerical reward value granted.
  final num rewardAmount;

  /// The network provider that delivered the completed creative (e.g. 'admob', 'meta', 'applovin', 'custom_ads').
  final String provider;

  /// Unique request trace identifier.
  final String requestId;

  /// Error details if the ad failed to load, display, or complete.
  final AdError? error;

  const RewardedAdResult({
    required this.success,
    required this.rewardGranted,
    this.rewardType = 'default',
    this.rewardAmount = 1,
    required this.provider,
    required this.requestId,
    this.error,
  });

  /// Successful completion factory.
  factory RewardedAdResult.granted({
    required String provider,
    required String requestId,
    String rewardType = 'default',
    num rewardAmount = 1,
  }) {
    return RewardedAdResult(
      success: true,
      rewardGranted: true,
      rewardType: rewardType,
      rewardAmount: rewardAmount,
      provider: provider,
      requestId: requestId,
    );
  }

  /// User dismissed early or skipped without completing requirement.
  factory RewardedAdResult.skipped({
    required String provider,
    required String requestId,
  }) {
    return RewardedAdResult(
      success: true,
      rewardGranted: false,
      rewardType: 'none',
      rewardAmount: 0,
      provider: provider,
      requestId: requestId,
    );
  }

  /// Ad failed to load, display, or hit timeout.
  factory RewardedAdResult.failed({
    required String provider,
    required String requestId,
    required AdError error,
  }) {
    return RewardedAdResult(
      success: false,
      rewardGranted: false,
      rewardType: 'none',
      rewardAmount: 0,
      provider: provider,
      requestId: requestId,
      error: error,
    );
  }

  @override
  String toString() =>
      'RewardedAdResult(success: $success, rewardGranted: $rewardGranted, type: $rewardType, amount: $rewardAmount, provider: $provider, error: $error)';
}
