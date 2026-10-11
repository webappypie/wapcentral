import 'package:flutter/material.dart';
import '../core/wap_notifications_core.dart';

/// A customizable Flutter bell icon widget with an unread badge counter.
class WapBellBadge extends StatelessWidget {
  const WapBellBadge({
    super.key,
    required this.onTap,
    this.icon = const Icon(Icons.notifications_outlined),
    this.badgeColor = Colors.redAccent,
    this.badgeTextColor = Colors.white,
    this.maxCountDisplay = 99,
  });

  /// Callback when user taps the bell icon.
  final VoidCallback onTap;

  /// The bell icon widget.
  final Widget icon;

  /// Background color of the unread badge circle.
  final Color badgeColor;

  /// Text color of the unread badge counter.
  final Color badgeTextColor;

  /// Maximum count to display before showing e.g. "99+".
  final int maxCountDisplay;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: StreamBuilder<int>(
        stream: WapNotificationsCore.instance.unreadCountStream,
        initialData: WapNotificationsCore.instance.cachedUnreadCount,
        builder: (context, snapshot) {
          final count = snapshot.data ?? 0;

          return Padding(
            padding: const EdgeInsets.all(8.0),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                icon,
                if (count > 0)
                  Positioned(
                    top: -4,
                    right: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(
                        color: badgeColor,
                        shape: BoxShape.rectangle,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 16,
                        minHeight: 16,
                      ),
                      child: Text(
                        count > maxCountDisplay ? '$maxCountDisplay+' : count.toString(),
                        style: TextStyle(
                          color: badgeTextColor,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
