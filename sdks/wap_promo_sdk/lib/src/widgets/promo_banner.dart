import 'package:flutter/material.dart';
import '../../wap_promo_sdk.dart';

/// A non-blocking banner widget that renders promotional campaigns.
/// Automatically hides itself (SizedBox.shrink()) when no valid campaign is available,
/// when capped, or on image loading failure.
class WapPromoBanner extends StatefulWidget {
  /// Optional custom callback when user taps the Call-To-Action button or banner.
  final void Function(String storeUrl)? onCtaTap;

  /// Optional background color for the banner.
  final Color? backgroundColor;

  /// Optional elevation.
  final double elevation;

  /// Optional custom margin.
  final EdgeInsetsGeometry margin;

  const WapPromoBanner({
    super.key,
    this.onCtaTap,
    this.backgroundColor,
    this.elevation = 2.0,
    this.margin = const EdgeInsets.symmetric(horizontal: 12.0, vertical: 6.0),
  });

  @override
  State<WapPromoBanner> createState() => _WapPromoBannerState();
}

class _WapPromoBannerState extends State<WapPromoBanner> {
  String? _lastRecordedImpressionCampaignId;

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

        // Record impression once per unique campaign instance shown
        if (_lastRecordedImpressionCampaignId != promo.campaignId &&
            promo.campaignId != null) {
          _lastRecordedImpressionCampaignId = promo.campaignId;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            WapPromoSdk.recordImpression(promo.campaignId!);
          });
        }

        final theme = Theme.of(context);
        final bg = widget.backgroundColor ?? theme.cardColor;

        return Card(
          elevation: widget.elevation,
          margin: widget.margin,
          color: bg,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.0)),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => _handleTap(promo),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 8.0),
              child: Row(
                children: [
                  // Thumbnail Image
                  if (promo.imageUrl != null && promo.imageUrl!.isNotEmpty)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6.0),
                      child: Image.network(
                        promo.imageUrl!,
                        width: 48,
                        height: 48,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const SizedBox(width: 48, height: 48),
                      ),
                    ),
                  if (promo.imageUrl != null && promo.imageUrl!.isNotEmpty)
                    const SizedBox(width: 10),

                  // Title & Description
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          promo.title ?? '',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        if (promo.description != null && promo.description!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 2.0),
                            child: Text(
                              promo.description!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.textTheme.bodySmall?.color?.withAlpha(178),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Call To Action Button
                  ElevatedButton(
                    onPressed: () => _handleTap(promo),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 6.0),
                      minimumSize: const Size(60, 32),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: Text(
                      promo.ctaText ?? 'Install',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _handleTap(PromoPayload promo) {
    if (promo.campaignId != null) {
      WapPromoSdk.recordClick(promo.campaignId!);
    }
    final storeUrl = promo.storeUrl ?? '';
    widget.onCtaTap?.call(storeUrl);
  }
}
