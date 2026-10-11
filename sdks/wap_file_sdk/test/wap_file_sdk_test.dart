import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:wap_core_sdk/wap_core_sdk.dart';
import 'package:wap_file_sdk/wap_file_sdk.dart';

void main() {
  group('WapFile SDK', () {
    test('search() parses natural language search intent and matches', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, endsWith('/files/search'));
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['query'], '2025 ka electricity bill dhundo');
        expect(body['localCandidates'], isNotNull);

        return http.Response(
          jsonEncode({
            'success': true,
            'requestId': 'req_file_1',
            'appId': 'filezen',
            'service': 'files',
            'version': 'v1',
            'executionSource': 'wap_engine',
            'data': {
              'query': '2025 ka electricity bill dhundo',
              'parsedIntent': {
                'category': 'bills_receipts',
                'targetYear': 2025,
                'targetMonth': null,
                'documentType': 'bill',
                'keywords': ['electricity', 'bill', '2025'],
              },
              'matchedFiles': [
                {
                  'fileId': 'doc_01',
                  'fileName': 'Electricity_Bill_March_2025.pdf',
                  'relevanceScore': 95,
                  'matchedSnippet': 'Electricity bill payment for account #9988',
                  'categoryMatched': 'bills_receipts',
                  'reasons': ['matches target year 2025', 'matches keyword electricity'],
                },
              ],
              'recommendedLocalFilters': {
                'extensionIn': ['pdf', 'jpg', 'png'],
                'dateAfter': '2025-01-01T00:00:00Z',
                'dateBefore': '2025-12-31T23:59:59Z',
                'regexPattern': '.*electricity.*',
              },
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
      final file = WapFile(config: wapClient.config, client: wapClient);

      final res = await file.search(
        query: '2025 ka electricity bill dhundo',
        localCandidates: [
          FileCandidate(
            id: 'doc_01',
            name: 'Electricity_Bill_March_2025.pdf',
            extension: 'pdf',
            sizeBytes: 1048576,
            extractedSnippet: 'Electricity bill payment for account #9988',
          ),
        ],
      );

      expect(res.success, true);
      expect(res.data?.parsedIntent.category, 'bills_receipts');
      expect(res.data?.parsedIntent.targetYear, 2025);
      expect(res.data?.matchedFiles.length, 1);
      expect(res.data?.matchedFiles[0].fileName, 'Electricity_Bill_March_2025.pdf');
      expect(res.data?.matchedFiles[0].relevanceScore, 95);
      expect(res.data?.recommendedLocalFilters?.extensionIn, contains('pdf'));
    });

    test('classify() categorizes files and detects duplicates', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, endsWith('/files/classify'));
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        final files = body['files'] as List<dynamic>;
        expect(files.length, 2);

        return http.Response(
          jsonEncode({
            'success': true,
            'requestId': 'req_file_2',
            'appId': 'filezen',
            'service': 'files',
            'version': 'v1',
            'executionSource': 'wap_engine',
            'data': {
              'results': [
                {
                  'id': 'f1',
                  'name': 'salary_slip_april.pdf',
                  'category': 'financial',
                  'suggestedTags': ['salary', 'income', 'payroll'],
                  'confidence': 0.95,
                  'isDuplicateCandidate': false,
                },
                {
                  'id': 'f2',
                  'name': 'salary_slip_april_copy.pdf',
                  'category': 'financial',
                  'suggestedTags': ['salary', 'income'],
                  'confidence': 0.95,
                  'isDuplicateCandidate': true,
                  'duplicateOfId': 'f1',
                },
              ],
              'totalClassified': 2,
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
      final file = WapFile(config: wapClient.config, client: wapClient);

      final res = await file.classify(
        files: [
          FileItemToClassify(id: 'f1', name: 'salary_slip_april.pdf', sizeBytes: 512000),
          FileItemToClassify(id: 'f2', name: 'salary_slip_april_copy.pdf', sizeBytes: 512000),
        ],
      );

      expect(res.success, true);
      expect(res.data?.totalClassified, 2);
      expect(res.data?.results[0].category, 'financial');
      expect(res.data?.results[1].isDuplicateCandidate, true);
      expect(res.data?.results[1].duplicateOfId, 'f1');
    });
  });
}
