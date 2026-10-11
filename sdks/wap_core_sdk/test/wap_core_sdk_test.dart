import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:wap_core_sdk/wap_core_sdk.dart';

void main() {
  group('WapConfig', () {
    test('creates valid config with default values', () {
      final config = WapConfig(appId: 'filezen', appKey: 'test_key');
      expect(config.appId, 'filezen');
      expect(config.appKey, 'test_key');
      expect(config.baseUrl, contains('/api/platform/v1'));
      expect(config.environment, 'production');
      expect(config.preferLocal, true);
    });

    test('named constructors for FileZen and OptiLens configure correct appIds', () {
      final filezen = WapConfig.filezen(appKey: 'key_1');
      expect(filezen.appId, 'filezen');

      final optilens = WapConfig.optilens(appKey: 'key_2');
      expect(optilens.appId, 'optilens');
    });
  });

  group('WapClient', () {
    test('successfully executes POST request and parses envelope', () async {
      final mockClient = MockClient((request) async {
        expect(request.headers['X-App-Id'], 'filezen');
        expect(request.headers['X-App-Key'], 'test_key');
        expect(request.headers['Content-Type'], 'application/json');

        return http.Response(
          jsonEncode({
            'success': true,
            'requestId': 'req_12345',
            'appId': 'filezen',
            'service': 'ai',
            'version': 'v1',
            'executionSource': 'wap_engine',
            'data': {'text': 'Generated summary text'},
            'usage': {'inputTokens': 50, 'outputTokens': 20},
            'timestamp': DateTime.now().toIso8601String(),
          }),
          200,
        );
      });

      final client = WapClient(
        config: WapConfig(appId: 'filezen', appKey: 'test_key'),
        httpClient: mockClient,
      );

      final res = await client.post<String>(
        path: '/ai/generate',
        body: {'prompt': 'test prompt'},
        dataParser: (d) => d['text'] as String,
      );

      expect(res.success, true);
      expect(res.requestId, 'req_12345');
      expect(res.data, 'Generated summary text');
      expect(res.executionSource, ExecutionSource.wapEngine);
      expect(res.usage?.inputTokens, 50);
    });

    test('throws WapServiceNotAuthorizedException on 403 with SERVICE_NOT_AUTHORIZED', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': false,
            'service': 'ocr',
            'error': {
              'code': 'SERVICE_NOT_AUTHORIZED',
              'message': 'App optilens is not authorized for ocr',
            },
          }),
          403,
        );
      });

      final client = WapClient(
        config: WapConfig(appId: 'optilens', appKey: 'test_key'),
        httpClient: mockClient,
      );

      expect(
        () => client.post<dynamic>(
          path: '/ocr/extract',
          body: {},
          dataParser: (d) => d,
        ),
        throwsA(isA<WapServiceNotAuthorizedException>()),
      );
    });

    test('throws WapQuotaExceededException on 429', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {'code': 'QUOTA_EXCEEDED', 'message': 'Rate limit exceeded'},
          }),
          429,
        );
      });

      final client = WapClient(
        config: WapConfig(appId: 'filezen', appKey: 'test_key'),
        httpClient: mockClient,
      );

      expect(
        () => client.post<dynamic>(
          path: '/ai/generate',
          body: {},
          dataParser: (d) => d,
        ),
        throwsA(isA<WapQuotaExceededException>()),
      );
    });

    test('throws WapServiceDisabledException on 503', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {'code': 'SERVICE_DISABLED', 'message': 'Service killed'},
          }),
          503,
        );
      });

      final client = WapClient(
        config: WapConfig(appId: 'filezen', appKey: 'test_key'),
        httpClient: mockClient,
      );

      expect(
        () => client.post<dynamic>(
          path: '/ai/generate',
          body: {},
          dataParser: (d) => d,
        ),
        throwsA(isA<WapServiceDisabledException>()),
      );
    });
  });
}
