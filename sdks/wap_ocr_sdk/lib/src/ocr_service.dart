import 'package:wap_core_sdk/wap_core_sdk.dart';
import 'ocr_models.dart';

/// Reusable OCR & Document Intelligence SDK client for mobile applications (FileZen, etc.).
/// Encapsulates local-first text extraction, multilingual OCR, receipt/invoice parsing,
/// and searchable text generation.
class WapOcr {
  final WapClient _client;

  WapOcr({
    required WapConfig config,
    WapClient? client,
  }) : _client = client ?? WapClient(config: config);

  /// Performs OCR text extraction on image data or PDF data.
  Future<WapResponse<OcrExtractResult>> extract({
    String? imageData,
    String? pdfData,
    String documentType = 'general',
    List<String>? languages,
    bool structuredExtract = false,
    bool? preferLocal,
  }) {
    if (imageData == null && pdfData == null) {
      throw ArgumentError('Either imageData or pdfData must be provided.');
    }

    return _client.post<OcrExtractResult>(
      path: '/ocr/extract',
      body: {
        if (imageData != null) 'imageData': imageData,
        if (pdfData != null) 'pdfData': pdfData,
        'documentType': documentType,
        if (languages != null) 'languages': languages,
        'structuredExtract': structuredExtract,
        'preferLocal': preferLocal ?? _client.config.preferLocal,
      },
      dataParser: (d) => OcrExtractResult.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Convenience shortcut for extracting structured receipt or invoice data.
  Future<WapResponse<OcrExtractResult>> extractReceipt({
    required String imageData,
    List<String>? languages,
    bool? preferLocal,
  }) {
    return extract(
      imageData: imageData,
      documentType: 'receipt',
      structuredExtract: true,
      languages: languages,
      preferLocal: preferLocal,
    );
  }

  /// Convenience shortcut for document text extraction with searchable index.
  Future<WapResponse<OcrExtractResult>> extractDocument({
    required String imageData,
    List<String>? languages,
    bool? preferLocal,
  }) {
    return extract(
      imageData: imageData,
      documentType: 'document',
      structuredExtract: false,
      languages: languages,
      preferLocal: preferLocal,
    );
  }
}
