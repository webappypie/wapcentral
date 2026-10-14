import 'package:flutter/material.dart';
import '../../wap_promo_sdk.dart';

/// A compact sponsored native-style placement widget designed for app home screens.
///
/// Key Requirements:
/// - Clear **Sponsored** label prominently displayed above the creative.
/// - Maximum container/creative height capped at **120 logical pixels (dp)**.
/// - Native-ad-style layout integrating seamlessly into host application design.
/// - Completely hides (`SizedBox.shrink()`) if no valid, non-expired campaign is available.
/// - Opens the configured destination upon interaction.
/// - Dispatches genuine telemetry for impressions and clicks.
class WapSponsoredPlacement extends StatefulWidget {
  final void Function(String destinationUrl)? onDestinationTap;
  final EdgeInsetsGeometry margin;
  final double elevation;
  final Color? backgroundColor;
  final BorderRadius? borderRadius;

  const WapSponsoredPlacement({
    super.key,
    this.onDestinationTap,
    this.margin = const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
    this.elevation = 0.5,
    this.backgroundColor,
    this.borderRadius,
  });

  @override
  State<WapSponsoredPlacement> createState() => _WapSponsoredPlacementState();
}

class _WapSponsoredPlacementState extends State<WapSponsoredPlacement> {
  String? _lastImpressionCampaignId;

  @override
  Widget build(BuildContext context) {
    if (!WapPromoSdk.isReady) {
      return const SizedBox.shrink();
    }

    return ValueListenableBuilder<PromoPayload?>(
      valueListenable: WapPromoSdk.promoNotifier,
      builder: (context, promo, _) {
        if (promo == null || !promo.hasContent || promo.isExpired()) {
          return const SizedBox.shrink();
        }

        // Record genuine impression once per campaign lifecycle
        if (_lastImpressionCampaignId != promo.campaignId && promo.campaignId != null) {
          _lastImpressionCampaignId = promo.campaignId;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            WapPromoSdk.recordImpression(promo.campaignId!);
          });
        }

        final theme = Theme.of(context);
        final labelText = (promo.sponsorLabel != null && promo.sponsorLabel!.trim().isNotEmpty)
            ? promo.sponsorLabel!.trim()
            : 'Sponsored';
        final effectiveBorderRadius = widget.borderRadius ?? BorderRadius.circular(10.0);

        return Semantics(
          label: '$labelText: ${promo.title ?? ""}',
          button: true,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 120.0),
            child: Padding(
              padding: widget.margin,
              child: Material(
                color: widget.backgroundColor ?? theme.cardTheme.color ?? theme.colorScheme.surface,
                elevation: widget.elevation,
                shape: RoundedRectangleBorder(
                  borderRadius: effectiveBorderRadius,
                  side: BorderSide(
                    color: theme.dividerColor.withAlpha(25),
                    width: 1.0,
                  ),
                ),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  borderRadius: effectiveBorderRadius,
                  onTap: () {
                    if (promo.campaignId != null) {
                      WapPromoSdk.recordClick(promo.campaignId!);
                    }
                    widget.onDestinationTap?.call(promo.storeUrl ?? '');
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Clear Sponsored label above the creative
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                              decoration: BoxDecoration(
                                color: theme.colorScheme.primary.withAlpha(20),
                                borderRadius: BorderRadius.circular(3),
                              ),
                              child: Text(
                                labelText.toUpperCase(),
                                style: TextStyle(
                                  fontSize: 9.5,
                                  letterSpacing: 0.5,
                                  fontWeight: FontWeight.w700,
                                  color: theme.colorScheme.primary,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        // Compact native content row
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            if (promo.imageUrl != null && promo.imageUrl!.isNotEmpty) ...[
                              ClipRRect(
                                borderRadius: BorderRadius.circular(8.0),
                                child: SizedBox(
                                  width: 48,
                                  height: 48,
                                  child: Image.network(
                                    promo.imageUrl!,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                            ],
                            Expanded(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    promo.title ?? '',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: theme.textTheme.titleSmall?.copyWith(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13.0,
                                    ),
                                  ),
                                  if (promo.description != null && promo.description!.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      promo.description!,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: theme.textTheme.bodySmall?.copyWith(
                                        fontSize: 11.5,
                                        color: theme.textTheme.bodySmall?.color?.withAlpha(180),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            // Compact CTA Button
                            ElevatedButton(
                              onPressed: () {
                                if (promo.campaignId != null) {
                                  WapPromoSdk.recordClick(promo.campaignId!);
                                }
                                widget.onDestinationTap?.call(promo.storeUrl ?? '');
                              },
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                minimumSize: const Size(0, 30),
                                visualDensity: VisualDensity.compact,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(6.0),
                                ),
                              ),
                              child: Text(
                                promo.ctaText?.isNotEmpty == true ? promo.ctaText! : 'Open',
                                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
