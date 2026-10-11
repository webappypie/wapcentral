import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:wap_core_sdk/wap_core_sdk.dart';
import 'package:wap_ocr_sdk/wap_ocr_sdk.dart';

void main() {
  group('WapOcr SDK', () {
    test('extract() calls /ocr/extract and parses plain document', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, endsWith('/ocr/extract'));
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['documentType'], 'general');
        expect(body['preferLocal'], true);

        return http.Response(
          jsonEncode({
            'success': true,
            'requestId': 'req_ocr_1',
            'appId': 'filezen',
            'service': 'ocr',
            'version': 'v1',
            'executionSource': 'wap_engine',
            'data': {
              'fullText': 'WebAppyPie Platform Architecture 2026',
              'detectedLanguage': 'en',
              'confidence': 0.99,
              'lineCount': 1,
              'documentType': 'general',
              'searchableText': 'webappypie platform architecture 2026',
              'fields': [],
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
      final ocr = WapOcr(config: wapClient.config, client: wapClient);

      final res = await ocr.extract(imageData: 'sample_doc_base64');
      expect(res.success, true);
      expect(res.data?.fullText, 'WebAppyPie Platform Architecture 2026');
      expect(res.data?.detectedLanguage, 'en');
      expect(res.data?.confidence, 0.99);
      expect(res.data?.searchableText, contains('webappypie'));
    });

    test('extractReceipt() sends structuredExtract: true and parses fields', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, endsWith('/ocr/extract'));
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['documentType'], 'receipt');
        expect(body['structuredExtract'], true);

        return http.Response(
          jsonEncode({
            'success': true,
            'requestId': 'req_ocr_2',
            'appId': 'filezen',
            'service': 'ocr',
            'version': 'v1',
            'executionSource': 'wap_engine',
            'data': {
              'fullText': 'Electricity Bill\nTotal: 1540.00\nDate: 2025-05-12',
              'detectedLanguage': 'en',
              'confidence': 0.96,
              'lineCount': 3,
              'documentType': 'receipt',
              'searchableText': 'electricity bill total 1540 date 2025-05-12',
              'structuredData': {
                'merchant': 'Tata Power',
                'amount': 1540.00,
                'date': '2025-05-12',
              },
              'fields': [
                {
                  'fieldName': 'total_amount',
                  'fieldValue': '1540.00',
                  'confidence': 0.98,
                  'boundingBox': [10.0, 20.0, 100.0, 30.0],
                },
                {
                  'fieldName': 'bill_date',
                  'fieldValue': '2025-05-12',
                  'confidence': 0.95,
                },
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
      final ocr = WapOcr(config: wapClient.config, client: wapClient);

      final res = await ocr.extractReceipt(imageData: 'receipt_base64');
      expect(res.success, true);
      expect(res.data?.documentType, 'receipt');
      expect(res.data?.fields.length, 2);
      expect(res.data?.fields[0].fieldName, 'total_amount');
      expect(res.data?.fields[0].fieldValue, '1540.00');
      expect(res.data?.fields[0].boundingBox, [10.0, 20.0, 100.0, 30.0]);
      expect(res.data?.structuredData?['amount'], 1540.00);
    });

    test('extract() throws ArgumentError if no data provided', () async {
      final wapClient = WapClient(
        config: WapConfig.filezen(appKey: 'wap_key_filezen_prod'),
      );
      final ocr = WapOcr(config: wapClient.config, client: wapClient);

      expect(() => ocr.extract(), throwsArgumentError);
    });
  });
}
