/// Image dimensions container.
class ImageDimensions {
  final int width;
  final int height;

  const ImageDimensions({required this.width, required this.height});

  factory ImageDimensions.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const ImageDimensions(width: 0, height: 0);
    return ImageDimensions(
      width: json['width'] as int? ?? 0,
      height: json['height'] as int? ?? 0,
    );
  }
}

/// Result of image enhancement operations.
class ImageEnhanceResult {
  final String operation;
  final String? outputImageData;
  final String directive;
  final String? recommendedModel;
  final Map<String, dynamic> appliedSettings;
  final ImageDimensions? originalDimensions;
  final ImageDimensions? enhancedDimensions;
  final int? compressionSavedBytes;

  ImageEnhanceResult({
    required this.operation,
    this.outputImageData,
    required this.directive,
    this.recommendedModel,
    required this.appliedSettings,
    this.originalDimensions,
    this.enhancedDimensions,
    this.compressionSavedBytes,
  });

  factory ImageEnhanceResult.fromJson(Map<String, dynamic> json) {
    return ImageEnhanceResult(
      operation: json['operation'] as String? ?? 'enhance',
      outputImageData: json['outputImageData'] as String?,
      directive: json['directive'] as String? ?? 'completed_server_side',
      recommendedModel: json['recommendedModel'] as String?,
      appliedSettings: json['appliedSettings'] as Map<String, dynamic>? ?? {},
      originalDimensions: json['originalDimensions'] != null
          ? ImageDimensions.fromJson(json['originalDimensions'] as Map<String, dynamic>)
          : null,
      enhancedDimensions: json['enhancedDimensions'] != null
          ? ImageDimensions.fromJson(json['enhancedDimensions'] as Map<String, dynamic>)
          : null,
      compressionSavedBytes: json['compressionSavedBytes'] as int?,
    );
  }
}

/// Result of image quality and composition analysis.
class ImageAnalyzeResult {
  final int qualityScore;
  final bool isBlurry;
  final int blurScore;
  final ImageDimensions estimatedResolution;
  final bool hasFaces;
  final int facesCount;
  final List<String> recommendations;

  ImageAnalyzeResult({
    required this.qualityScore,
    required this.isBlurry,
    required this.blurScore,
    required this.estimatedResolution,
    required this.hasFaces,
    required this.facesCount,
    required this.recommendations,
  });

  factory ImageAnalyzeResult.fromJson(Map<String, dynamic> json) {
    return ImageAnalyzeResult(
      qualityScore: json['qualityScore'] as int? ?? 0,
      isBlurry: json['isBlurry'] as bool? ?? false,
      blurScore: json['blurScore'] as int? ?? 0,
      estimatedResolution: ImageDimensions.fromJson(
        json['estimatedResolution'] as Map<String, dynamic>?,
      ),
      hasFaces: json['hasFaces'] as bool? ?? false,
      facesCount: json['facesCount'] as int? ?? 0,
      recommendations: (json['recommendations'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
    );
  }
}
