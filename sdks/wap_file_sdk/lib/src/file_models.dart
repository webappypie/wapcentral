/// Metadata of candidate files kept locally on device, sent only for scoring matching relevance.
/// Full file content is NEVER transmitted by default, preserving absolute local privacy.
class FileCandidate {
  final String id;
  final String name;
  final String? extension;
  final String? mimeType;
  final int? sizeBytes;
  final String? dateCreated;
  final String? dateModified;
  final String? extractedSnippet;
  final List<String>? tags;

  FileCandidate({
    required this.id,
    required this.name,
    this.extension,
    this.mimeType,
    this.sizeBytes,
    this.dateCreated,
    this.dateModified,
    this.extractedSnippet,
    this.tags,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      if (extension != null) 'extension': extension,
      if (mimeType != null) 'mimeType': mimeType,
      if (sizeBytes != null) 'sizeBytes': sizeBytes,
      if (dateCreated != null) 'dateCreated': dateCreated,
      if (dateModified != null) 'dateModified': dateModified,
      if (extractedSnippet != null) 'extractedSnippet': extractedSnippet,
      if (tags != null) 'tags': tags,
    };
  }
}

/// Parsed natural language intent from a query like "2025 ka electricity bill dhundo".
class FileSearchIntent {
  final String? category;
  final int? targetYear;
  final String? targetMonth;
  final String? documentType;
  final List<String> keywords;

  FileSearchIntent({
    this.category,
    this.targetYear,
    this.targetMonth,
    this.documentType,
    required this.keywords,
  });

  factory FileSearchIntent.fromJson(Map<String, dynamic>? json) {
    if (json == null) return FileSearchIntent(keywords: []);
    return FileSearchIntent(
      category: json['category'] as String?,
      targetYear: json['targetYear'] as int?,
      targetMonth: json['targetMonth'] as String?,
      documentType: json['documentType'] as String?,
      keywords: (json['keywords'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
    );
  }
}

/// Recommended local filters so the device SQLite/MediaStore engine can filter locally without cloud inference.
class LocalFilters {
  final List<String>? extensionIn;
  final String? dateAfter;
  final String? dateBefore;
  final String? regexPattern;

  LocalFilters({
    this.extensionIn,
    this.dateAfter,
    this.dateBefore,
    this.regexPattern,
  });

  factory LocalFilters.fromJson(Map<String, dynamic>? json) {
    if (json == null) return LocalFilters();
    return LocalFilters(
      extensionIn: (json['extensionIn'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      dateAfter: json['dateAfter'] as String?,
      dateBefore: json['dateBefore'] as String?,
      regexPattern: json['regexPattern'] as String?,
    );
  }
}

/// Result of matching a specific file against query intent.
class FileMatchResult {
  final String? fileId;
  final String? fileName;
  final int relevanceScore;
  final String? matchedSnippet;
  final String? categoryMatched;
  final List<String> reasons;

  FileMatchResult({
    this.fileId,
    this.fileName,
    required this.relevanceScore,
    this.matchedSnippet,
    this.categoryMatched,
    required this.reasons,
  });

  factory FileMatchResult.fromJson(Map<String, dynamic> json) {
    return FileMatchResult(
      fileId: json['fileId'] as String?,
      fileName: json['fileName'] as String?,
      relevanceScore: json['relevanceScore'] as int? ?? 0,
      matchedSnippet: json['matchedSnippet'] as String?,
      categoryMatched: json['categoryMatched'] as String?,
      reasons: (json['reasons'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
    );
  }
}

/// Result of semantic/natural language file search.
class FileSearchResult {
  final String query;
  final FileSearchIntent parsedIntent;
  final List<FileMatchResult> matchedFiles;
  final LocalFilters? recommendedLocalFilters;

  FileSearchResult({
    required this.query,
    required this.parsedIntent,
    required this.matchedFiles,
    this.recommendedLocalFilters,
  });

  factory FileSearchResult.fromJson(Map<String, dynamic> json) {
    return FileSearchResult(
      query: json['query'] as String? ?? '',
      parsedIntent: FileSearchIntent.fromJson(
        json['parsedIntent'] as Map<String, dynamic>?,
      ),
      matchedFiles: (json['matchedFiles'] as List<dynamic>?)
              ?.map((e) => FileMatchResult.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      recommendedLocalFilters: json['recommendedLocalFilters'] != null
          ? LocalFilters.fromJson(
              json['recommendedLocalFilters'] as Map<String, dynamic>,
            )
          : null,
    );
  }
}

/// File item descriptor to send for classification.
class FileItemToClassify {
  final String id;
  final String name;
  final String? extension;
  final String? mimeType;
  final int? sizeBytes;
  final String? sampleText;

  FileItemToClassify({
    required this.id,
    required this.name,
    this.extension,
    this.mimeType,
    this.sizeBytes,
    this.sampleText,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      if (extension != null) 'extension': extension,
      if (mimeType != null) 'mimeType': mimeType,
      if (sizeBytes != null) 'sizeBytes': sizeBytes,
      if (sampleText != null) 'sampleText': sampleText,
    };
  }
}

/// Classified file categorization result with tags and duplicate detection.
class ClassifiedItem {
  final String id;
  final String name;
  final String category;
  final List<String> suggestedTags;
  final double confidence;
  final bool isDuplicateCandidate;
  final String? duplicateOfId;

  ClassifiedItem({
    required this.id,
    required this.name,
    required this.category,
    required this.suggestedTags,
    required this.confidence,
    this.isDuplicateCandidate = false,
    this.duplicateOfId,
  });

  factory ClassifiedItem.fromJson(Map<String, dynamic> json) {
    return ClassifiedItem(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      category: json['category'] as String? ?? 'other',
      suggestedTags: (json['suggestedTags'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0.0,
      isDuplicateCandidate: json['isDuplicateCandidate'] as bool? ?? false,
      duplicateOfId: json['duplicateOfId'] as String?,
    );
  }
}

/// Result of batch file classification.
class FileClassifyResult {
  final List<ClassifiedItem> results;
  final int totalClassified;

  FileClassifyResult({
    required this.results,
    required this.totalClassified,
  });

  factory FileClassifyResult.fromJson(Map<String, dynamic> json) {
    return FileClassifyResult(
      results: (json['results'] as List<dynamic>?)
              ?.map((e) => ClassifiedItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      totalClassified: json['totalClassified'] as int? ?? 0,
    );
  }
}
