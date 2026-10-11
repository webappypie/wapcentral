import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:wap_core_sdk/wap_core_sdk.dart';
import 'package:wap_ai_sdk/wap_ai_sdk.dart';

void main() {
  group('WapAi SDK', () {
    test('generate() calls /ai/generate and parses result', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, endsWith('/ai/generate'));
        return http.Response(
          jsonEncode({
            'success': true,
            'requestId': 'req_ai_1',
            'appId': 'filezen',
            'service': 'ai',
            'version': 'v1',
            'executionSource': 'external_provider',
            'data': {
              'text': 'The quick brown fox',
              'modelId': 'gpt-4o-mini',
              'providerId': 'openai-production',
            },
            'timestamp': DateTime.now().toIso8601String(),
          }),
          200,
        );
      });

      final wapClient = WapClient(
        config: WapConfig.filezen(appKey: 'wap_key_filezen_prod'),
        httpClient: mockClient,
      );
      final ai = WapAi(config: wapClient.config, client: wapClient);

      final res = await ai.generate(prompt: 'Tell me a story');
      expect(res.success, true);
      expect(res.data?.text, 'The quick brown fox');
      expect(res.data?.modelId, 'gpt-4o-mini');
      expect(res.data?.providerId, 'openai-production');
      expect(res.executionSource, ExecutionSource.externalProvider);
    });

    test('classify() calls /ai/classify and parses labels', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, endsWith('/ai/classify'));
        return http.Response(
          jsonEncode({
            'success': true,
            'requestId': 'req_ai_2',
            'appId': 'filezen',
            'service': 'ai',
            'version': 'v1',
            'executionSource': 'wap_engine',
            'data': {
              'text': 'Electricity bill payment received',
              'predictedLabel': 'bills',
              'confidence': 0.98,
              'labels': [
                {'label': 'bills', 'score': 0.98},
                {'label': 'entertainment', 'score': 0.02},
              ],
            },
            'timestamp': DateTime.now().toIso8601String(),
          }),
          200,
        );
      });

      final wapClient = WapClient(
        config: WapConfig.filezen(appKey: 'wap_key_filezen_prod'),
        httpClient: mockClient,
      );
      final ai = WapAi(config: wapClient.config, client: wapClient);

      final res = await ai.classify(
        text: 'Electricity bill payment received',
        candidateLabels: ['bills', 'entertainment'],
      );
      expect(res.success, true);
      expect(res.data?.predictedLabel, 'bills');
      expect(res.data?.confidence, 0.98);
    });

    test('summarize() calls /ai/summarize and parses compression metrics', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, endsWith('/ai/summarize'));
        return http.Response(
          jsonEncode({
            'success': true,
            'requestId': 'req_ai_3',
            'appId': 'filezen',
            'service': 'ai',
            'version': 'v1',
            'executionSource': 'wap_engine',
            'data': {
              'summary': 'Short overview',
              'originalLength': 1000,
              'summaryLength': 14,
              'compressionRatio': 0.98,
            },
            'timestamp': DateTime.now().toIso8601String(),
          }),
          200,
        );
      });

      final wapClient = WapClient(
        config: WapConfig.filezen(appKey: 'wap_key_filezen_prod'),
        httpClient: mockClient,
      );
      final ai = WapAi(config: wapClient.config, client: wapClient);

      final res = await ai.summarize(text: 'Long document text here');
      expect(res.success, true);
      expect(res.data?.summary, 'Short overview');
      expect(res.data?.compressionRatio, 0.98);
    });
  });
}
