import 'package:flutter/material.dart';
import '../../wap_ads_sdk.dart';

/// Mediated native advertisement widget.
///
/// Automatically cascades through configured waterfall providers to render
/// an integrated in-feed or card advertisement.
class WapAdNative extends StatefulWidget {
  final String? placementId;
  final Widget? fallbackWidget;
  final VoidCallback? onAdLoaded;
  final Function(String error)? onAdFailedToLoad;
  final VoidCallback? onAdClicked;

  const WapAdNative({
    super.key,
    this.placementId,
    this.fallbackWidget,
    this.onAdLoaded,
    this.onAdFailedToLoad,
    this.onAdClicked,
  });

  @override
  State<WapAdNative> createState() => _WapAdNativeState();
}

class _WapAdNativeState extends State<WapAdNative> {
  bool _isLoading = true;
  AdNetwork? _winningNetwork;
  AdProviderAdapter? _winningAdapter;
  String? _winningUnitId;

  @override
  void initState() {
    super.initState();
    _loadMediatedNative();
  }

  Future<void> _loadMediatedNative() async {
    if (!WapAdsSdk.isReady) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
      return;
    }

    try {
      final decision = await WapAdsSdk.mediationManager.resolveAd(
        AdFormat.native,
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
          widget.onAdFailedToLoad?.call('All mediation waterfall providers failed to fill native ad');
        }
      }
    } catch (err) {
      if (mounted) {
        setState(() => _isLoading = false);
        widget.onAdFailedToLoad?.call('Native ad mediation exception: $err');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const SizedBox.shrink();
    }

    if (_winningAdapter != null) {
      return Container(
        key: ValueKey('native_${_winningNetwork?.name}'),
        child: _winningAdapter!.buildNativeWidget(
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
