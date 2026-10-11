/// Extracted field from structured OCR documents (receipts, forms, invoices).
class ExtractedField {
  final String fieldName;
  final dynamic fieldValue;
  final double confidence;
  final List<double>? boundingBox;

  ExtractedField({
    required this.fieldName,
    required this.fieldValue,
    required this.confidence,
    this.boundingBox,
  });

  factory ExtractedField.fromJson(Map<String, dynamic> json) {
    return ExtractedField(
      fieldName: json['fieldName'] as String? ?? '',
      fieldValue: json['fieldValue'],
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0.0,
      boundingBox: (json['boundingBox'] as List<dynamic>?)
          ?.map((e) => (e as num).toDouble())
          .toList(),
    );
  }
}

/// Result of OCR text and document extraction.
class OcrExtractResult {
  final String fullText;
  final String? detectedLanguage;
  final double confidence;
  final int lineCount;
  final Map<String, dynamic>? structuredData;
  final List<ExtractedField> fields;
  final String documentType;
  final String searchableText;

  OcrExtractResult({
    required this.fullText,
    this.detectedLanguage,
    required this.confidence,
    required this.lineCount,
    this.structuredData,
    required this.fields,
    required this.documentType,
    required this.searchableText,
  });

  factory OcrExtractResult.fromJson(Map<String, dynamic> json) {
    return OcrExtractResult(
      fullText: json['fullText'] as String? ?? '',
      detectedLanguage: json['detectedLanguage'] as String?,
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0.0,
      lineCount: json['lineCount'] as int? ?? 0,
      structuredData: json['structuredData'] as Map<String, dynamic>?,
      fields: (json['fields'] as List<dynamic>?)
              ?.map((e) => ExtractedField.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      documentType: json['documentType'] as String? ?? 'general',
      searchableText: json['searchableText'] as String? ?? '',
    );
  }
}
