/// Result of text generation.
class AiGenerateResult {
  final String text;
  final String modelId;
  final String providerId;

  AiGenerateResult({
    required this.text,
    required this.modelId,
    required this.providerId,
  });

  factory AiGenerateResult.fromJson(Map<String, dynamic> json) {
    return AiGenerateResult(
      text: json['text'] as String? ?? '',
      modelId: json['modelId'] as String? ?? 'unknown',
      providerId: json['providerId'] as String? ?? 'unknown',
    );
  }
}

/// Result of vision analysis.
class AiVisionResult {
  final String description;
  final List<String> detectedObjects;
  final String modelId;
  final String providerId;

  AiVisionResult({
    required this.description,
    required this.detectedObjects,
    required this.modelId,
    required this.providerId,
  });

  factory AiVisionResult.fromJson(Map<String, dynamic> json) {
    return AiVisionResult(
      description: json['description'] as String? ?? '',
      detectedObjects: (json['detectedObjects'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      modelId: json['modelId'] as String? ?? 'unknown',
      providerId: json['providerId'] as String? ?? 'unknown',
    );
  }
}

/// Result of text classification.
class AiClassifyResult {
  final String text;
  final String predictedLabel;
  final double confidence;
  final List<Map<String, dynamic>> labels;

  AiClassifyResult({
    required this.text,
    required this.predictedLabel,
    required this.confidence,
    required this.labels,
  });

  factory AiClassifyResult.fromJson(Map<String, dynamic> json) {
    return AiClassifyResult(
      text: json['text'] as String? ?? '',
      predictedLabel: json['predictedLabel'] as String? ?? '',
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0.0,
      labels: (json['labels'] as List<dynamic>?)
              ?.map((e) => e as Map<String, dynamic>)
              .toList() ??
          [],
    );
  }
}

/// Result of text summarization.
class AiSummarizeResult {
  final String summary;
  final int originalLength;
  final int summaryLength;
  final double compressionRatio;

  AiSummarizeResult({
    required this.summary,
    required this.originalLength,
    required this.summaryLength,
    required this.compressionRatio,
  });

  factory AiSummarizeResult.fromJson(Map<String, dynamic> json) {
    return AiSummarizeResult(
      summary: json['summary'] as String? ?? '',
      originalLength: json['originalLength'] as int? ?? 0,
      summaryLength: json['summaryLength'] as int? ?? 0,
      compressionRatio: (json['compressionRatio'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

/// Result of language translation.
class AiTranslateResult {
  final String translatedText;
  final String? detectedSourceLanguage;
  final String targetLanguage;

  AiTranslateResult({
    required this.translatedText,
    this.detectedSourceLanguage,
    required this.targetLanguage,
  });

  factory AiTranslateResult.fromJson(Map<String, dynamic> json) {
    return AiTranslateResult(
      translatedText: json['translatedText'] as String? ?? '',
      detectedSourceLanguage: json['detectedSourceLanguage'] as String?,
      targetLanguage: json['targetLanguage'] as String? ?? '',
    );
  }
}

/// Result of structured field extraction.
class AiExtractResult {
  final Map<String, dynamic> extractedData;
  final double confidence;

  AiExtractResult({
    required this.extractedData,
    required this.confidence,
  });

  factory AiExtractResult.fromJson(Map<String, dynamic> json) {
    return AiExtractResult(
      extractedData: json['extractedData'] as Map<String, dynamic>? ?? {},
      confidence: (json['confidence'] as num?)?.toDouble() ?? 1.0,
    );
  }
}
