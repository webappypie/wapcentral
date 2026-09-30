import 'package:flutter_test/flutter_test.dart';
import 'package:wap_promo_sdk/src/utils/crypto_validator.dart';

void main() {
  const secret = 'test_secret_key_123456789_secure!';

  group('CryptoValidator (HMAC-SHA256)', () {
    test('should compute and verify valid signature', () {
      final payload = <String, dynamic>{
        'schemaVersion': 1,
        'enabled': true,
        'campaignId': 'camp_123',
        'title': 'Test Promo',
        'cacheTtlSeconds': 21600,
      };

      final signature = CryptoValidator.computeSignature(payload, secret);
      expect(signature, isNotEmpty);

      final signedPayload = Map<String, dynamic>.from(payload)
        ..['signature'] = signature;

      final isValid = CryptoValidator.verifySignature(signedPayload, secret);
      expect(isValid, isTrue);
    });

    test('should reject signature if payload has been tampered with', () {
      final payload = <String, dynamic>{
        'schemaVersion': 1,
        'enabled': true,
        'campaignId': 'camp_123',
        'title': 'Original Title',
        'cacheTtlSeconds': 21600,
      };

      final signature = CryptoValidator.computeSignature(payload, secret);

      final tamperedPayload = Map<String, dynamic>.from(payload)
        ..['title'] = 'Tampered Title'
        ..['signature'] = signature;

      final isValid = CryptoValidator.verifySignature(tamperedPayload, secret);
      expect(isValid, isFalse);
    });

    test('should reject signature when verified with wrong secret', () {
      final payload = <String, dynamic>{
        'schemaVersion': 1,
        'enabled': true,
        'campaignId': 'camp_123',
        'cacheTtlSeconds': 3600,
      };

      final signature = CryptoValidator.computeSignature(payload, secret);

      final signedPayload = Map<String, dynamic>.from(payload)
        ..['signature'] = signature;

      final isValid = CryptoValidator.verifySignature(signedPayload, 'wrong_secret');
      expect(isValid, isFalse);
    });

    test('should reject missing or empty signature', () {
      final payloadWithoutSig = <String, dynamic>{
        'schemaVersion': 1,
        'enabled': true,
      };

      expect(CryptoValidator.verifySignature(payloadWithoutSig, secret), isFalse);

      final payloadWithEmptySig = <String, dynamic>{
        'schemaVersion': 1,
        'enabled': true,
        'signature': '',
      };

      expect(CryptoValidator.verifySignature(payloadWithEmptySig, secret), isFalse);
    });
  });
}
