import '../models/ad_error.dart';
import '../models/ad_format.dart';
import '../models/effective_ad_config.dart';

/// Validation result for frequency cap checks.
class FrequencyCheckResult {
  final bool allowed;
  final AdError? error;

  const FrequencyCheckResult({required this.allowed, this.error});

  static const FrequencyCheckResult permitted = FrequencyCheckResult(allowed: true);

  factory FrequencyCheckResult.denied(String code, String message) {
    return FrequencyCheckResult(
      allowed: false,
      error: AdError(code: code, message: message),
    );
  }
}

/// Client-side runtime frequency, cooldown, and pacing manager.
class FrequencyManager {
  // Session display counters
  final Map<AdFormat, int> _sessionFormatCounts = {};
  final Map<String, int> _sessionPlacementCounts = {};

  // Timestamps of last ad display
  final Map<AdFormat, DateTime> _lastFormatDisplayTimes = {};
  final Map<String, DateTime> _lastPlacementDisplayTimes = {};

  // Daily tracking: day key -> count
  String _currentDayKey = _getTodayKey();
  final Map<AdFormat, int> _dailyFormatCounts = {};
  final Map<String, int> _dailyPlacementCounts = {};

  // Lifecycle tracking for App Open ads
  DateTime? _lastBackgroundedTime;

  static String _getTodayKey() {
    final now = DateTime.now();
    return '${now.year}-${now.month}-${now.day}';
  }

  void _checkDayRollover() {
    final today = _getTodayKey();
    if (today != _currentDayKey) {
      _currentDayKey = today;
      _dailyFormatCounts.clear();
      _dailyPlacementCounts.clear();
    }
  }

  /// Record app entered background.
  void recordAppBackgrounded() {
    _lastBackgroundedTime = DateTime.now();
  }

  /// Checks whether an App Open ad satisfies the background rule (e.g. min 30s background).
  bool canShowAppOpenOnForeground({String? rule}) {
    if (rule == 'always' || rule == null) return true;
    if (rule == 'disabled') return false;
    if (rule == 'min_background_30s' || rule == 'after_background_30s') {
      if (_lastBackgroundedTime == null) return true;
      final diff = DateTime.now().difference(_lastBackgroundedTime!);
      return diff.inSeconds >= 30;
    }
    return true;
  }

  /// Validates whether an ad can be served given server-configured frequency caps and cooldowns.
  FrequencyCheckResult canDisplay({
    required AdFormat format,
    String? placementKey,
    FormatFrequency? formatFrequency,
    PlacementConfig? placementConfig,
  }) {
    _checkDayRollover();
    final now = DateTime.now();

    // 1. Format-level Cooldown Check
    if (formatFrequency != null && formatFrequency.cooldownSeconds > 0) {
      final lastTime = _lastFormatDisplayTimes[format];
      if (lastTime != null) {
        final elapsed = now.difference(lastTime).inSeconds;
        if (elapsed < formatFrequency.cooldownSeconds) {
          final remaining = formatFrequency.cooldownSeconds - elapsed;
          return FrequencyCheckResult.denied(
            AdError.cooldownActive,
            'Format ${format.name} is on cooldown. Remaining: ${remaining}s',
          );
        }
      }
    }

    // 2. Format-level Minimum Interval Check
    if (formatFrequency != null && formatFrequency.minIntervalSeconds > 0) {
      final lastTime = _lastFormatDisplayTimes[format];
      if (lastTime != null) {
        final elapsed = now.difference(lastTime).inSeconds;
        if (elapsed < formatFrequency.minIntervalSeconds) {
          return FrequencyCheckResult.denied(
            AdError.cooldownActive,
            'Format ${format.name} minimum interval not elapsed ($elapsed < ${formatFrequency.minIntervalSeconds}s).',
          );
        }
      }
    }

    // 3. Format-level Session Cap Check
    if (formatFrequency != null && formatFrequency.sessionCap > 0) {
      final count = _sessionFormatCounts[format] ?? 0;
      if (count >= formatFrequency.sessionCap) {
        return FrequencyCheckResult.denied(
          AdError.frequencyCapped,
          'Format ${format.name} session cap reached ($count/${formatFrequency.sessionCap}).',
        );
      }
    }

    // 4. Format-level Daily Cap Check
    if (formatFrequency != null && formatFrequency.dailyCap > 0) {
      final count = _dailyFormatCounts[format] ?? 0;
      if (count >= formatFrequency.dailyCap) {
        return FrequencyCheckResult.denied(
          AdError.frequencyCapped,
          'Format ${format.name} daily cap reached ($count/${formatFrequency.dailyCap}).',
        );
      }
    }

    // 5. Placement-level Cooldown Check
    if (placementKey != null && placementConfig != null) {
      final cooldown = placementConfig.cooldownSeconds ?? 0;
      if (cooldown > 0) {
        final lastTime = _lastPlacementDisplayTimes[placementKey];
        if (lastTime != null) {
          final elapsed = now.difference(lastTime).inSeconds;
          if (elapsed < cooldown) {
            return FrequencyCheckResult.denied(
              AdError.cooldownActive,
              'Placement $placementKey is on cooldown. Remaining: ${cooldown - elapsed}s',
            );
          }
        }
      }

      // 6. Placement Session Cap Check
      final sessionCap = placementConfig.sessionCap ?? 0;
      if (sessionCap > 0) {
        final count = _sessionPlacementCounts[placementKey] ?? 0;
        if (count >= sessionCap) {
          return FrequencyCheckResult.denied(
            AdError.frequencyCapped,
            'Placement $placementKey session cap reached ($count/$sessionCap).',
          );
        }
      }

      // 7. Placement Daily Cap Check
      final dailyCap = placementConfig.dailyCap ?? 0;
      if (dailyCap > 0) {
        final count = _dailyPlacementCounts[placementKey] ?? 0;
        if (count >= dailyCap) {
          return FrequencyCheckResult.denied(
            AdError.frequencyCapped,
            'Placement $placementKey daily cap reached ($count/$dailyCap).',
          );
        }
      }
    }

    return FrequencyCheckResult.permitted;
  }

  /// Records an ad impression/display.
  void recordDisplay(AdFormat format, {String? placementKey}) {
    _checkDayRollover();
    final now = DateTime.now();

    // Increment format counts
    _sessionFormatCounts[format] = (_sessionFormatCounts[format] ?? 0) + 1;
    _dailyFormatCounts[format] = (_dailyFormatCounts[format] ?? 0) + 1;
    _lastFormatDisplayTimes[format] = now;

    // Increment placement counts
    if (placementKey != null && placementKey.isNotEmpty) {
      _sessionPlacementCounts[placementKey] = (_sessionPlacementCounts[placementKey] ?? 0) + 1;
      _dailyPlacementCounts[placementKey] = (_dailyPlacementCounts[placementKey] ?? 0) + 1;
      _lastPlacementDisplayTimes[placementKey] = now;
    }
  }

  /// Clear all frequency state (used for testing or user logouts).
  void reset() {
    _sessionFormatCounts.clear();
    _sessionPlacementCounts.clear();
    _lastFormatDisplayTimes.clear();
    _lastPlacementDisplayTimes.clear();
    _dailyFormatCounts.clear();
    _dailyPlacementCounts.clear();
    _lastBackgroundedTime = null;
  }
}
