import 'package:flutter/material.dart';
import '../../wap_ads_sdk.dart';

/// Mediated banner advertisement widget.
///
/// Automatically waterfalls through configured ad networks (AdMob -> Meta -> AppLovin -> WAPAds)
/// until a valid ad fill is secured. If all providers fail, cleanly collapses to [fallbackWidget]
/// or [SizedBox.shrink] without throwing errors or interrupting app UI.
class WapAdBanner extends StatefulWidget {
  final String? placementId;
  final double height;
  final double? width;
  final Widget? fallbackWidget;
  final VoidCallback? onAdLoaded;
  final Function(String error)? onAdFailedToLoad;
  final VoidCallback? onAdClicked;

  const WapAdBanner({
    super.key,
    this.placementId,
    this.height = 50.0,
    this.width,
    this.fallbackWidget,
    this.onAdLoaded,
    this.onAdFailedToLoad,
    this.onAdClicked,
  });

  @override
  State<WapAdBanner> createState() => _WapAdBannerState();
}

class _WapAdBannerState extends State<WapAdBanner> {
  bool _isLoading = true;
  AdNetwork? _winningNetwork;
  AdProviderAdapter? _winningAdapter;
  String? _winningUnitId;

  @override
  void initState() {
    super.initState();
    _loadMediatedBanner();
  }

  Future<void> _loadMediatedBanner() async {
    if (!WapAdsSdk.isReady) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
      return;
    }

    try {
      final decision = await WapAdsSdk.mediationManager.resolveAd(
        AdFormat.banner,
        placementId: widget.placementId,
      );

      if (mounted) {
        if (decision.hasWinner && decision.winnerAdapter != null) {
          setState(() {
            _isLoading = false;
            _winningNetwork = decision.winnerNetwork;
            _winningAdapter = decision.winnerAdapter;
            _winningUnitId = decision.loadResult?.adUnitId;
          });
          widget.onAdLoaded?.call();
        } else {
          setState(() => _isLoading = false);
          widget.onAdFailedToLoad?.call('All mediation waterfall providers failed to fill banner');
        }
      }
    } catch (err) {
      if (mounted) {
        setState(() => _isLoading = false);
        widget.onAdFailedToLoad?.call('Banner mediation exception: $err');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return SizedBox(
        height: widget.height,
        width: widget.width ?? double.infinity,
        child: const SizedBox.shrink(),
      );
    }

    if (_winningAdapter != null) {
      return SizedBox(
        key: ValueKey('banner_${_winningNetwork?.name}'),
        height: widget.height,
        width: widget.width ?? double.infinity,
        child: _winningAdapter!.buildBannerWidget(
          context: context,
          adUnitId: _winningUnitId,
          onAdLoaded: widget.onAdLoaded,
          onAdFailedToLoad: widget.onAdFailedToLoad,
          onAdClicked: widget.onAdClicked,
        ),
      );
    }

    return widget.fallbackWidget ?? const SizedBox.shrink();
  }
}
