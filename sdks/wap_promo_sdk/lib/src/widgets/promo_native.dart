import 'package:flutter/material.dart';
import '../../wap_promo_sdk.dart';

/// A native feed card widget for cross-promotion campaigns.
/// Designed to integrate smoothly into scrollable feeds or dashboards.
class WapPromoNative extends StatefulWidget {
  final void Function(String storeUrl)? onCtaTap;
  final EdgeInsetsGeometry margin;
  final double elevation;

  const WapPromoNative({
    super.key,
    this.onCtaTap,
    this.margin = const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
    this.elevation = 1.0,
  });

  @override
  State<WapPromoNative> createState() => _WapPromoNativeState();
}

class _WapPromoNativeState extends State<WapPromoNative> {
  String? _lastImpressionCampaignId;

  @override
  Widget build(BuildContext context) {
    if (!WapPromoSdk.isReady) {
      return const SizedBox.shrink();
    }

    return ValueListenableBuilder<PromoPayload?>(
      valueListenable: WapPromoSdk.promoNotifier,
      builder: (context, promo, _) {
        if (promo == null || !promo.hasContent) {
          return const SizedBox.shrink();
        }

        // Record impression once
        if (_lastImpressionCampaignId != promo.campaignId && promo.campaignId != null) {
          _lastImpressionCampaignId = promo.campaignId;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            WapPromoSdk.recordImpression(promo.campaignId!);
          });
        }

        final theme = Theme.of(context);

        return Card(
          elevation: widget.elevation,
          margin: widget.margin,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.0)),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Hero Creative Image
              if (promo.imageUrl != null && promo.imageUrl!.isNotEmpty)
                AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Image.network(
                    promo.imageUrl!,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
                ),

              Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.primary.withAlpha(31),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'PROMOTED',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: theme.colorScheme.primary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            promo.title ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (promo.description != null && promo.description!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 6.0, bottom: 12.0),
                        child: Text(
                          promo.description!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.textTheme.bodyMedium?.color?.withAlpha(191),
                          ),
                        ),
                      ),

                    // Call To Action
                    Align(
                      alignment: Alignment.centerRight,
                      child: ElevatedButton(
                        onPressed: () {
                          if (promo.campaignId != null) {
                            WapPromoSdk.recordClick(promo.campaignId!);
                          }
                          widget.onCtaTap?.call(promo.storeUrl ?? '');
                        },
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8.0),
                          ),
                        ),
                        child: Text(
                          promo.ctaText ?? 'Try Free',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
