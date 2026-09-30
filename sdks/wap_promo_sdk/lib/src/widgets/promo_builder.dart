import 'package:flutter/material.dart';
import '../../wap_promo_sdk.dart';

/// A custom builder widget that exposes the active promotion payload to custom layouts.
class WapPromoBuilder extends StatelessWidget {
  final Widget Function(BuildContext context, PromoPayload? promo) builder;

  const WapPromoBuilder({
    super.key,
    required this.builder,
  });

  @override
  Widget build(BuildContext context) {
    if (!WapPromoSdk.isReady) {
      return builder(context, null);
    }

    return ValueListenableBuilder<PromoPayload?>(
      valueListenable: WapPromoSdk.promoNotifier,
      builder: (context, promo, _) => builder(context, promo),
    );
  }
}
