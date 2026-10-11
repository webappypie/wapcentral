import 'package:wap_core_sdk/wap_core_sdk.dart';
import 'ai_models.dart';

/// Unified AI Intelligence client for WebAppyPie mobile applications.
/// Hides provider implementation details (OpenAI, Gemini, Anthropic) behind WAPCentral.
/// Applications NEVER receive provider API keys.
class WapAi {
  final WapClient _client;

  WapAi({
    required WapConfig config,
    WapClient? client,
  }) : _client = client ?? WapClient(config: config);

  /// Generates text or chat completions.
  Future<WapResponse<AiGenerateResult>> generate({
    String? prompt,
    List<Map<String, String>>? messages,
    String? systemPrompt,
    double? temperature,
    int? maxTokens,
    String? modelPreference,
  }) {
    return _client.post<AiGenerateResult>(
      path: '/ai/generate',
      body: {
        if (prompt != null) 'prompt': prompt,
        if (messages != null) 'messages': messages,
        if (systemPrompt != null) 'systemPrompt': systemPrompt,
        if (temperature != null) 'temperature': temperature,
        if (maxTokens != null) 'maxTokens': maxTokens,
        if (modelPreference != null) 'modelPreference': modelPreference,
      },
      dataParser: (d) => AiGenerateResult.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Multimodal vision analysis.
  Future<WapResponse<AiVisionResult>> vision({
    required String prompt,
    required String imageData, // base64 or URL
    int? maxTokens,
  }) {
    return _client.post<AiVisionResult>(
      path: '/ai/vision',
      body: {
        'prompt': prompt,
        'imageData': imageData,
        if (maxTokens != null) 'maxTokens': maxTokens,
      },
      dataParser: (d) => AiVisionResult.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Classifies text into one of candidate labels.
  Future<WapResponse<AiClassifyResult>> classify({
    required String text,
    required List<String> candidateLabels,
    bool multiLabel = false,
  }) {
    return _client.post<AiClassifyResult>(
      path: '/ai/classify',
      body: {
        'text': text,
        'candidateLabels': candidateLabels,
        'multiLabel': multiLabel,
      },
      dataParser: (d) => AiClassifyResult.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Summarizes document or text content.
  Future<WapResponse<AiSummarizeResult>> summarize({
    required String text,
    int? maxLength,
    String format = 'paragraph', // paragraph | bullet_points | key_takeaways
  }) {
    return _client.post<AiSummarizeResult>(
      path: '/ai/summarize',
      body: {
        'text': text,
        if (maxLength != null) 'maxLength': maxLength,
        'format': format,
      },
      dataParser: (d) => AiSummarizeResult.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Translates text into target language.
  Future<WapResponse<AiTranslateResult>> translate({
    required String text,
    String? sourceLanguage,
    required String targetLanguage,
  }) {
    return _client.post<AiTranslateResult>(
      path: '/ai/translate',
      body: {
        'text': text,
        if (sourceLanguage != null) 'sourceLanguage': sourceLanguage,
        'targetLanguage': targetLanguage,
      },
      dataParser: (d) => AiTranslateResult.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Extracts structured fields from document text.
  Future<WapResponse<AiExtractResult>> extract({
    required String text,
    required List<String> targetFields,
    Map<String, String>? schemaDefinition,
  }) {
    return _client.post<AiExtractResult>(
      path: '/ai/extract',
      body: {
        'text': text,
        'targetFields': targetFields,
        if (schemaDefinition != null) 'schemaDefinition': schemaDefinition,
      },
      dataParser: (d) => AiExtractResult.fromJson(d as Map<String, dynamic>),
    );
  }
}
