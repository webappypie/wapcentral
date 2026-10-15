import 'dart:convert';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';

/// RSA public key (JWK `n`/`e`) used to verify server-signed promotion payloads.
///
/// Public keys are not secrets: apps can embed them safely. The matching
/// private key stays on the server (e.g. in Cloud KMS).
class PromoRsaPublicKey {
  final BigInt modulus;
  final BigInt exponent;

  const PromoRsaPublicKey({required this.modulus, required this.exponent});

  /// From the base64url `n` and `e` members of an RSA JWK.
  factory PromoRsaPublicKey.fromJwk({required String n, required String e}) {
    return PromoRsaPublicKey(modulus: _bigIntFromBase64Url(n), exponent: _bigIntFromBase64Url(e));
  }

  /// Modulus length in bytes.
  int get byteLength => (modulus.bitLength + 7) >> 3;

  static BigInt _bigIntFromBase64Url(String value) => _bytesToBigInt(_base64UrlDecode(value));
}

/// Cryptographic verification utility for promotion payloads.
///
/// - `RS256` (preferred): RSASSA-PKCS1-v1_5 with SHA-256, verified with a
///   public key; the signing key never leaves the server.
/// - HMAC-SHA256 (legacy): needs the shared secret on the device.
class CryptoValidator {
  /// Signature algorithm name carried in payloads as `signatureAlg`.
  static const String rs256 = 'RS256';

  /// Canonical string both signature schemes sign: keys sorted, `signature`
  /// and null values skipped, `key:value` pairs joined by `|`.
  static String canonicalString(Map<String, dynamic> payload) {
    final keys = payload.keys
        .where((k) => k != 'signature' && payload[k] != null)
        .toList()
      ..sort();

    return keys.map((k) => '$k:${payload[k].toString()}').join('|');
  }

  /// Computes the expected HMAC-SHA256 signature for a given payload map.
  /// Canonicalizes keys in sorted order matching the backend promotion-api logic.
  static String computeSignature(Map<String, dynamic> payload, String secret) {
    final keyBytes = utf8.encode(secret);
    final dataBytes = utf8.encode(canonicalString(payload));
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

  /// Verifies an `RS256` payload: `signatureAlg` must be `RS256`, `keyId` must
  /// name one of [keys], and `signature` (base64url) must be a valid
  /// RSASSA-PKCS1-v1_5 SHA-256 signature of [canonicalString].
  static bool verifyRs256Signature(Map<String, dynamic> payload, Map<String, PromoRsaPublicKey> keys) {
    final signature = payload['signature'];
    final keyId = payload['keyId'];
    if (payload['signatureAlg'] != rs256 || signature is! String || keyId is! String) {
      return false;
    }
    final key = keys[keyId];
    if (key == null) return false;

    final Uint8List signatureBytes;
    try {
      signatureBytes = _base64UrlDecode(signature);
    } on FormatException {
      return false;
    }
    final k = key.byteLength;
    if (signatureBytes.length != k) return false;

    final s = _bytesToBigInt(signatureBytes);
    if (s >= key.modulus) return false;
    final encoded = _bigIntToBytes(s.modPow(key.exponent, key.modulus), k);

    final digest = sha256.convert(utf8.encode(canonicalString(payload))).bytes;
    final expected = _emsaPkcs1v15Sha256(digest, k);
    if (expected == null) return false;

    var diff = 0;
    for (var i = 0; i < k; i++) {
      diff |= encoded[i] ^ expected[i];
    }
    return diff == 0;
  }

  /// EMSA-PKCS1-v1_5 encoding of a SHA-256 digest (RFC 8017 §9.2).
  static Uint8List? _emsaPkcs1v15Sha256(List<int> digest, int k) {
    const digestInfoPrefix = [
      0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, //
      0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20,
    ];
    final tLen = digestInfoPrefix.length + digest.length;
    if (k < tLen + 11) return null;
    final em = Uint8List(k);
    em[0] = 0x00;
    em[1] = 0x01;
    for (var i = 2; i < k - tLen - 1; i++) {
      em[i] = 0xff;
    }
    em[k - tLen - 1] = 0x00;
    em.setRange(k - tLen, k - digest.length, digestInfoPrefix);
    em.setRange(k - digest.length, k, digest);
    return em;
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

Uint8List _base64UrlDecode(String value) {
  final normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  final padded = normalized.padRight((normalized.length + 3) ~/ 4 * 4, '=');
  return base64.decode(padded);
}

BigInt _bytesToBigInt(List<int> bytes) {
  var result = BigInt.zero;
  for (final b in bytes) {
    result = (result << 8) | BigInt.from(b);
  }
  return result;
}

Uint8List _bigIntToBytes(BigInt value, int length) {
  final out = Uint8List(length);
  var v = value;
  for (var i = length - 1; i >= 0; i--) {
    out[i] = (v & BigInt.from(0xff)).toInt();
    v = v >> 8;
  }
  return out;
}
