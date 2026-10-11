import 'package:wap_core_sdk/wap_core_sdk.dart';
import 'file_models.dart';

/// Reusable File Intelligence SDK client for mobile applications (FileZen, etc.).
/// Encapsulates local-first semantic search, natural language document discovery ("2025 ka electricity bill dhundo"),
/// categorization, and duplicate detection.
///
/// CRITICAL PRIVACY PRINCIPLE:
/// The SDK NEVER uploads the user's complete private file library. It only transmits
/// lightweight candidate metadata or the query intent itself so filtering stays on-device.
class WapFile {
  final WapClient _client;

  WapFile({
    required WapConfig config,
    WapClient? client,
  }) : _client = client ?? WapClient(config: config);

  /// Performs semantic / natural language file search.
  /// Example: `WapFile.search("2025 ka electricity bill dhundo", localCandidates: [...])`
  Future<WapResponse<FileSearchResult>> search({
    required String query,
    List<FileCandidate>? localCandidates,
    int? limit,
    String? targetCategory,
  }) {
    return _client.post<FileSearchResult>(
      path: '/files/search',
      body: {
        'query': query,
        if (localCandidates != null)
          'localCandidates': localCandidates.map((c) => c.toJson()).toList(),
        if (limit != null) 'limit': limit,
        if (targetCategory != null) 'targetCategory': targetCategory,
      },
      dataParser: (d) => FileSearchResult.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Classifies a batch of files into standardized categories, generates auto-tags,
  /// and detects duplicate file candidates.
  Future<WapResponse<FileClassifyResult>> classify({
    required List<FileItemToClassify> files,
  }) {
    return _client.post<FileClassifyResult>(
      path: '/files/classify',
      body: {
        'files': files.map((f) => f.toJson()).toList(),
      },
      dataParser: (d) => FileClassifyResult.fromJson(d as Map<String, dynamic>),
    );
  }
}
