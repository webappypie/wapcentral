import 'package:flutter/material.dart';
import '../../wap_promo_sdk.dart';

/// Fullscreen or modal takeover widget for high-impact promotions.
class WapPromoInterstitial extends StatelessWidget {
  final PromoPayload promo;
  final void Function(String storeUrl)? onCtaTap;
  final VoidCallback? onDismiss;

  const WapPromoInterstitial({
    super.key,
    required this.promo,
    this.onCtaTap,
    this.onDismiss,
  });

  /// Displays the current active promotion as an interstitial modal dialog.
  /// Returns `true` if displayed, `false` if no valid campaign is available.
  static Future<bool> show(
    BuildContext context, {
    void Function(String storeUrl)? onCtaTap,
    VoidCallback? onDismiss,
  }) async {
    final promo = WapPromoSdk.getCurrentPromo();
    if (promo == null || !promo.hasContent) {
      return false;
    }

    // Record impression
    if (promo.campaignId != null) {
      WapPromoSdk.recordImpression(promo.campaignId!);
    }

    await showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => WapPromoInterstitial(
        promo: promo,
        onCtaTap: onCtaTap,
        onDismiss: onDismiss,
      ),
    );

    return true;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.0)),
      clipBehavior: Clip.antiAlias,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 400),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header with Close Button
            Stack(
              children: [
                if (promo.imageUrl != null && promo.imageUrl!.isNotEmpty)
                  AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Image.network(
                      promo.imageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                    ),
                  ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: CircleAvatar(
                    radius: 16,
                    backgroundColor: Colors.black.withAlpha(128),
                    child: IconButton(
                      icon: const Icon(Icons.close, size: 16, color: Colors.white),
                      padding: EdgeInsets.zero,
                      onPressed: () {
                        Navigator.of(context).pop();
                        onDismiss?.call();
                      },
                    ),
                  ),
                ),
              ],
            ),

            // Content
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    promo.title ?? '',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (promo.description != null && promo.description!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 8.0),
                      child: Text(
                        promo.description!,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.textTheme.bodyMedium?.color?.withAlpha(204),
                        ),
                      ),
                    ),
                  const SizedBox(height: 16),

                  // Call To Action Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        if (promo.campaignId != null) {
                          WapPromoSdk.recordClick(promo.campaignId!);
                        }
                        Navigator.of(context).pop();
                        onCtaTap?.call(promo.storeUrl ?? '');
                      },
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12.0),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8.0),
                        ),
                      ),
                      child: Text(
                        promo.ctaText ?? 'Install Free',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
