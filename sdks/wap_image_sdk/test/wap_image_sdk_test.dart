import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:wap_core_sdk/wap_core_sdk.dart';
import 'package:wap_image_sdk/wap_image_sdk.dart';

void main() {
  group('WapImage SDK', () {
    test('enhance() calls /image/enhance and parses directive and output', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, endsWith('/image/enhance'));
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['operation'], 'super_resolution');
        expect(body['scaleFactor'], 4);
        expect(body['preferLocal'], true);

        return http.Response(
          jsonEncode({
            'success': true,
            'requestId': 'req_img_1',
            'appId': 'optilens',
            'service': 'image',
            'version': 'v1',
            'executionSource': 'wap_engine',
            'data': {
              'operation': 'super_resolution',
              'outputImageData': 'base64_enhanced_bytes...',
              'directive': 'process_locally',
              'recommendedModel': 'optilens_lite_sr_v1',
              'appliedSettings': {'scaleFactor': 4, 'denoiseStrength': 0.2},
              'originalDimensions': {'width': 1080, 'height': 1920},
              'enhancedDimensions': {'width': 4320, 'height': 7680},
              'compressionSavedBytes': 0,
            },
            'timestamp': DateTime.now().toIso8601String(),
          }),
          200,
        );
      });

      final wapClient = WapClient(
        config: WapConfig.optilens(appKey: 'wap_key_optilens_prod', preferLocal: true),
        httpClient: mockClient,
      );
      final image = WapImage(config: wapClient.config, client: wapClient);

      final res = await image.enhance(
        imageData: 'base64_raw_bytes...',
        operation: 'super_resolution',
        scaleFactor: 4,
        denoiseStrength: 0.2,
      );

      expect(res.success, true);
      expect(res.data?.operation, 'super_resolution');
      expect(res.data?.directive, 'process_locally');
      expect(res.data?.recommendedModel, 'optilens_lite_sr_v1');
      expect(res.data?.enhancedDimensions?.width, 4320);
      expect(res.data?.enhancedDimensions?.height, 7680);
    });

    test('analyze() calls /image/analyze and parses quality metrics', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, endsWith('/image/analyze'));

        return http.Response(
          jsonEncode({
            'success': true,
            'requestId': 'req_img_2',
            'appId': 'optilens',
            'service': 'image',
            'version': 'v1',
            'executionSource': 'wap_engine',
            'data': {
              'qualityScore': 87,
              'isBlurry': false,
              'blurScore': 12,
              'estimatedResolution': {'width': 3024, 'height': 4032},
              'hasFaces': true,
              'facesCount': 2,
              'recommendations': ['apply_hdr', 'face_enhance'],
            },
            'timestamp': DateTime.now().toIso8601String(),
          }),
          200,
        );
      });

      final wapClient = WapClient(
        config: WapConfig.optilens(appKey: 'wap_key_optilens_prod'),
        httpClient: mockClient,
      );
      final image = WapImage(config: wapClient.config, client: wapClient);

      final res = await image.analyze(imageData: 'sample_raw_bytes...');

      expect(res.success, true);
      expect(res.data?.qualityScore, 87);
      expect(res.data?.isBlurry, false);
      expect(res.data?.facesCount, 2);
      expect(res.data?.recommendations, contains('apply_hdr'));
    });
  });
}
