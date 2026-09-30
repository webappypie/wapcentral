import 'dart:convert';
import 'package:crypto/crypto.dart';

/// Cryptographic verification utility for validating HMAC-SHA256 signatures on promotion payloads.
class CryptoValidator {
  /// Computes the expected HMAC-SHA256 signature for a given payload map.
  /// Canonicalizes keys in sorted order matching the backend promotion-api logic.
  static String computeSignature(Map<String, dynamic> payload, String secret) {
    final keys = payload.keys
        .where((k) => k != 'signature' && payload[k] != null)
        .toList()
      ..sort();

    final canonicalString = keys
        .map((k) => '$k:${payload[k].toString()}')
        .join('|');

    final keyBytes = utf8.encode(secret);
    final dataBytes = utf8.encode(canonicalString);
    final hmac = Hmac(sha256, keyBytes);

    return hmac.convert(dataBytes).toString();
  }

  /// Verifies whether the provided signature matches the expected HMAC-SHA256 signature.
  /// Uses constant-time comparison to guard against timing attacks.
  static bool verifySignature(Map<String, dynamic> payload, String secret) {
    final providedSignature = payload['signature'];
    if (providedSignature is! String || providedSignature.isEmpty) {
      return false;
    }

    final expectedSignature = computeSignature(payload, secret);
    return constantTimeEquals(providedSignature.toLowerCase(), expectedSignature.toLowerCase());
  }

  /// Constant-time string equality comparison.
  static bool constantTimeEquals(String a, String b) {
    if (a.length != b.length) {
      return false;
    }

    int result = 0;
    for (int i = 0; i < a.length; i++) {
      result |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return result == 0;
  }
}
