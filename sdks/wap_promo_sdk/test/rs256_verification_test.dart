import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:wap_promo_sdk/wap_promo_sdk.dart';

/// Fixture signed with a throwaway RSA-2048 key (private half discarded) in the
/// exact form WAPCentral admin-api signs promotions (RS256 over the canonical string).
const _n = 'iJTw18CmszNqWV1a2i5uAlUNvXjSmjR_D-bSuO0MLwu7T0p3fRQXQd605rzU6LXqLsPhX0voD5KP1riHyOUdtaiLUGOZ3tdOtPkA1ro10iZH_Idz8nLhgx3ckXhNXGhXYf0YNhOOlL6lhP5f-D5PTcp-OJDQhjj7AGhRZSetVDa4o5JyHCK5fx6kdB4kWVQ7nck8GTnReNmPHj-Wj7PaX1B3e3K7YvlU7hcwwzoHeukDHkbkl8ymaeUeds4uTjvVtWSJ4tJ1ly2BKlg-MoiiVrrSQ6L1rqYKGLBNGPpL5vREkYARKuE5DNpQ2OZlw97Juce4x4BQM8tNTKHQ-S2UJw';
const _e = 'AQAB';
const _signedPayload = '{"schemaVersion":1,"enabled":true,"campaignId":"camp_rs","title":"RS256 Promo","storeUrl":"https://example.com/app","cacheTtlSeconds":21600,"frequencyCap":{"maxImpressions":3,"periodHours":24},"signatureAlg":"RS256","keyId":"test-key-1","signature":"ZgdTMxUtUpTMPtAO-gWt-m8bg7kmyyCTwBxOkOO_R6HsqObxW2O03dfavWlpk69yhGu01h9M3wIKaOMKwwRBdwXuvZ3wp9gxcekgDdrVfUoteyZ32Xj1JD1cTSGyPWJTkpjX2tjB4lOpVrp-jQWXSpt51wD1vyZ466aJQ6FqEqqZBmtqkdupxkym1h0L3zOq2EWZYHw0BQFXcOP-G72jtjuNO1JYDEWVyq0vi8mr1kd-0R-eVMvmN2kmcbty7Pphi4Xb8TY_HnUfSDyRFsEtJoLacd7ZiZ9F54cqdsL6NkxullOLlzLUR-YpUQdsjGAn6ZLXirE-rmlQDxws17VGiA"}';

final _keys = {'test-key-1': PromoRsaPublicKey.fromJwk(n: _n, e: _e)};

Map<String, dynamic> _payload() => jsonDecode(_signedPayload) as Map<String, dynamic>;

void main() {
  group('CryptoValidator RS256', () {
    test('verifies a server-signed payload with the public key', () {
      expect(CryptoValidator.verifyRs256Signature(_payload(), _keys), isTrue);
    });

    test('rejects tampered fields, including nested maps', () {
      expect(CryptoValidator.verifyRs256Signature({..._payload(), 'storeUrl': 'https://evil.example.com'}, _keys), isFalse);
      expect(
        CryptoValidator.verifyRs256Signature(
            {..._payload(), 'frequencyCap': {'maxImpressions': 999, 'periodHours': 24}}, _keys),
        isFalse,
      );
    });

    test('rejects unknown key ids, other algorithms and malformed signatures', () {
      expect(CryptoValidator.verifyRs256Signature({..._payload(), 'keyId': 'other'}, _keys), isFalse);
      expect(CryptoValidator.verifyRs256Signature({..._payload(), 'signatureAlg': 'HS256'}, _keys), isFalse);
      expect(CryptoValidator.verifyRs256Signature({..._payload(), 'signature': 'not*base64'}, _keys), isFalse);
      expect(CryptoValidator.verifyRs256Signature({..._payload(), 'signature': 'AAAA'}, _keys), isFalse);
      expect(CryptoValidator.verifyRs256Signature(_payload(), const {}), isFalse);
    });
  });

  group('PromoService with verificationKeys', () {
    PromoService serviceReturning(String body) => PromoService(
          config: PromoConfig(
            appId: 'app_01',
            appKey: 'k',
            baseUrl: 'https://example.com/api/platform',
            verificationKeys: _keys,
          ),
          cache: PromoCache(null),
          client: MockClient((_) async => http.Response(body, 200)),
        );

    test('accepts an RS256-signed campaign without any shared secret', () async {
      final service = serviceReturning(_signedPayload);
      final promo = await service.fetchCampaign(forceRefresh: true);

      expect(promo?.campaignId, 'camp_rs');
      expect(service.promoNotifier.value?.title, 'RS256 Promo');
    });

    test('ignores HMAC-signed or unsigned payloads once public keys are configured', () async {
      const hmacSecret = 'shared';
      final hmacPayload = <String, dynamic>{
        'schemaVersion': 1,
        'enabled': true,
        'campaignId': 'camp_forged',
        'title': 'Forged',
        'cacheTtlSeconds': 60,
      };
      hmacPayload['signature'] = CryptoValidator.computeSignature(hmacPayload, hmacSecret);

      final service = serviceReturning(jsonEncode(hmacPayload));
      await service.fetchCampaign(forceRefresh: true);

      expect(service.promoNotifier.value, isNull);
    });
  });
}
