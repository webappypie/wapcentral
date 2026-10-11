import 'package:wap_core_sdk/wap_core_sdk.dart';
import 'image_models.dart';

/// Reusable Image Intelligence SDK client for mobile applications (OptiLens AI, etc.).
/// Encapsulates image enhancement, super-resolution, denoise, and quality analysis.
/// Local-First Principle: The SDK does not care whether the backend uses on-device processing,
/// native OpenCV, self-hosted GPU, or external provider.
class WapImage {
  final WapClient _client;

  WapImage({
    required WapConfig config,
    WapClient? client,
  }) : _client = client ?? WapClient(config: config);

  /// Enhances an image using the selected operation.
  /// Supported operations:
  /// - 'enhance' (general AI auto-enhancement)
  /// - 'super_resolution' (upscaling 2x / 4x)
  /// - 'denoise' (noise reduction)
  /// - 'sharpen' (edge sharpening)
  /// - 'deblur' (motion/blur removal)
  /// - 'hdr' (high dynamic range enhancement)
  /// - 'low_light' (low-light exposure boost)
  /// - 'color_correct' (color balance restoration)
  /// - 'face_enhance' (portrait and face detail restoration)
  /// - 'restore' (vintage/old photo restoration)
  /// - 'compress' (smart size reduction)
  Future<WapResponse<ImageEnhanceResult>> enhance({
    required String imageData, // base64 or URL
    String operation = 'enhance',
    int? scaleFactor, // 2 or 4
    String qualityPreset = 'balanced', // fast | balanced | high_quality
    bool? preferLocal,
    double? denoiseStrength,
    double? sharpenAmount,
    double? hdrIntensity,
    String? targetFormat,
  }) {
    return _client.post<ImageEnhanceResult>(
      path: '/image/enhance',
      body: {
        'imageData': imageData,
        'operation': operation,
        if (scaleFactor != null) 'scaleFactor': scaleFactor,
        'qualityPreset': qualityPreset,
        'preferLocal': preferLocal ?? _client.config.preferLocal,
        'options': {
          if (denoiseStrength != null) 'denoiseStrength': denoiseStrength,
          if (sharpenAmount != null) 'sharpenAmount': sharpenAmount,
          if (hdrIntensity != null) 'hdrIntensity': hdrIntensity,
          if (targetFormat != null) 'targetFormat': targetFormat,
        },
      },
      dataParser: (d) => ImageEnhanceResult.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Analyzes image quality, blur, and resolution heuristics.
  Future<WapResponse<ImageAnalyzeResult>> analyze({
    required String imageData,
    List<String>? checks,
  }) {
    return _client.post<ImageAnalyzeResult>(
      path: '/image/analyze',
      body: {
        'imageData': imageData,
        if (checks != null) 'checks': checks,
      },
      dataParser: (d) => ImageAnalyzeResult.fromJson(d as Map<String, dynamic>),
    );
  }
}
