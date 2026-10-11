import 'package:flutter/material.dart';
import '../models/ad_format.dart';
import '../models/effective_ad_config.dart';
import 'custom_ad_tracker.dart';

/// Flutter widget for rendering WebAppyPie first-party custom promotional ads.
class CustomAdWidget extends StatefulWidget {
  final CustomAdFallback fallbackData;
  final AdFormat format;
  final String? placementKey;
  final CustomAdTracker? tracker;
  final VoidCallback? onLoaded;
  final VoidCallback? onClicked;

  const CustomAdWidget({
    super.key,
    required this.fallbackData,
    this.format = AdFormat.banner,
    this.placementKey,
    this.tracker,
    this.onLoaded,
    this.onClicked,
  });

  @override
  State<CustomAdWidget> createState() => _CustomAdWidgetState();
}

class _CustomAdWidgetState extends State<CustomAdWidget> {
  bool _impressionTracked = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _trackImpression();
      widget.onLoaded?.call();
    });
  }

  void _trackImpression() {
    if (!_impressionTracked && widget.tracker != null) {
      _impressionTracked = true;
      widget.tracker?.track(
        campaignId: widget.fallbackData.campaignId,
        type: 'impression',
        placementKey: widget.placementKey,
        format: widget.format,
      );
    }
  }

  void _handleClick() {
    widget.tracker?.track(
      campaignId: widget.fallbackData.campaignId,
      type: 'click',
      placementKey: widget.placementKey,
      format: widget.format,
    );
    widget.onClicked?.call();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.format == AdFormat.banner) {
      return _buildBannerLayout();
    } else {
      return _buildCardLayout();
    }
  }

  Widget _buildBannerLayout() {
    return Container(
      width: double.infinity,
      height: 50,
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        border: Border.all(color: const Color(0xFF93C5FD)),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _handleClick,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2563EB),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: const Text(
                    'PROMO',
                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.fallbackData.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A)),
                      ),
                      Text(
                        widget.fallbackData.description,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 10, color: Color(0xFF3B82F6)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2563EB),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    widget.fallbackData.ctaText,
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCardLayout() {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: InkWell(
        onTap: _handleClick,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3B82F6),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text('Featured', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                  const Spacer(),
                  const Text('WebAppyPie', style: TextStyle(fontSize: 10, color: Colors.grey)),
                ],
              ),
              const SizedBox(height: 8),
              if (widget.fallbackData.thumbnailUrl != null || widget.fallbackData.imageUrl != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: Image.network(
                    widget.fallbackData.thumbnailUrl ?? widget.fallbackData.imageUrl!,
                    height: 120,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
                ),
                const SizedBox(height: 8),
              ],
              Text(
                widget.fallbackData.title,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                widget.fallbackData.description,
                style: const TextStyle(fontSize: 13, color: Colors.black87),
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: ElevatedButton(
                  onPressed: _handleClick,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                  ),
                  child: Text(widget.fallbackData.ctaText),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
