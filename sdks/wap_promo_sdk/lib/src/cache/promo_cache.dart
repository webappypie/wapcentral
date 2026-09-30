import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/promo_payload.dart';

/// Persistent local cache for promotional campaigns and frequency capping records.
/// Delivers zero-latency boot by loading cached payloads immediately.
class PromoCache {
  static const String _keyPrefix = 'wap_promo_';
  static const String _payloadKey = '${_keyPrefix}payload_';
  static const String _timestampKey = '${_keyPrefix}ts_';
  static const String _impressionsKey = '${_keyPrefix}imp_';

  final SharedPreferences? _prefs;

  // In-memory fallback if SharedPreferences is null (e.g. testing)
  final Map<String, String> _memoryStore = {};

  PromoCache([this._prefs]);

  /// Factory creating an initialized PromoCache instance.
  static Future<PromoCache> create() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return PromoCache(prefs);
    } catch (_) {
      // In-memory fallback if SharedPreferences fails or in unit tests
      return PromoCache(null);
    }
  }

  /// Retrieves the cached promotion payload for an app.
  PromoPayload? getCachedPayload(String appId) {
    final key = '$_payloadKey$appId';
    final jsonStr = _prefs?.getString(key) ?? _memoryStore[key];
    if (jsonStr == null || jsonStr.isEmpty) {
      return null;
    }
    return PromoPayload.fromJsonString(jsonStr);
  }

  /// Persists a promotion payload for an app along with current timestamp.
  Future<void> setCachedPayload(String appId, PromoPayload payload) async {
    final payloadKey = '$_payloadKey$appId';
    final tsKey = '$_timestampKey$appId';
    final jsonStr = payload.toJsonString();
    final nowMs = DateTime.now().millisecondsSinceEpoch;

    if (_prefs != null) {
      await _prefs!.setString(payloadKey, jsonStr);
      await _prefs!.setInt(tsKey, nowMs);
    } else {
      _memoryStore[payloadKey] = jsonStr;
      _memoryStore[tsKey] = nowMs.toString();
    }
  }

  /// Checks if the cached payload is still fresh according to its TTL and expiration.
  bool isCacheFresh(String appId) {
    final payload = getCachedPayload(appId);
    if (payload == null) return false;
    if (payload.isExpired()) return false;

    final tsKey = '$_timestampKey$appId';
    final tsValue = _prefs != null
        ? _prefs!.getInt(tsKey)
        : int.tryParse(_memoryStore[tsKey] ?? '');

    if (tsValue == null) return false;

    final fetchedAt = DateTime.fromMillisecondsSinceEpoch(tsValue);
    final cacheTtl = Duration(seconds: payload.cacheTtlSeconds);
    return DateTime.now().isBefore(fetchedAt.add(cacheTtl));
  }

  /// Records an impression timestamp for frequency capping.
  Future<void> recordImpression(String campaignId) async {
    final key = '$_impressionsKey$campaignId';
    final rawList = _prefs?.getStringList(key) ??
        (_memoryStore[key] != null ? jsonDecode(_memoryStore[key]!).cast<String>() : <String>[]);

    final nowIso = DateTime.now().toIso8601String();
    final updatedList = List<String>.from(rawList)..add(nowIso);

    if (_prefs != null) {
      await _prefs!.setStringList(key, updatedList);
    } else {
      _memoryStore[key] = jsonEncode(updatedList);
    }
  }

  /// Determines if a campaign has reached its impression limit within the configured time window.
  bool isFrequencyCapped(String campaignId, int maxImpressions, int periodHours) {
    if (maxImpressions <= 0 || periodHours <= 0) return false;

    final key = '$_impressionsKey$campaignId';
    final rawList = _prefs?.getStringList(key) ??
        (_memoryStore[key] != null ? jsonDecode(_memoryStore[key]!).cast<String>() : <String>[]);

    if (rawList.isEmpty) return false;

    final cutoff = DateTime.now().subtract(Duration(hours: periodHours));

    int validImpressions = 0;
    for (final iso in rawList) {
      final dt = DateTime.tryParse(iso);
      if (dt != null && dt.isAfter(cutoff)) {
        validImpressions++;
      }
    }

    return validImpressions >= maxImpressions;
  }

  /// Clears all promotion cache and impression counters.
  Future<void> clearAll() async {
    if (_prefs != null) {
      final keys = _prefs!.getKeys().where((k) => k.startsWith(_keyPrefix)).toList();
      for (final k in keys) {
        await _prefs!.remove(k);
      }
    }
    _memoryStore.clear();
  }
}
