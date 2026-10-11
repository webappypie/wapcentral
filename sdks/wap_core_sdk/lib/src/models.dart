/// Where the request was executed.
enum ExecutionSource {
  onDevice,
  wapEngine,
  externalProvider,
}

ExecutionSource parseExecutionSource(String? value) {
  switch (value) {
    case 'on_device':
      return ExecutionSource.onDevice;
    case 'external_provider':
      return ExecutionSource.externalProvider;
    case 'wap_engine':
    default:
      return ExecutionSource.wapEngine;
  }
}

/// Token or processing usage metrics returned by the platform.
class WapUsage {
  final int? requests;
  final int? inputTokens;
  final int? outputTokens;
  final int? totalTokens;
  final int? latencyMs;
  final int? processingVolumeBytes;

  WapUsage({
    this.requests,
    this.inputTokens,
    this.outputTokens,
    this.totalTokens,
    this.latencyMs,
    this.processingVolumeBytes,
  });

  factory WapUsage.fromJson(Map<String, dynamic>? json) {
    if (json == null) return WapUsage();
    return WapUsage(
      requests: json['requests'] as int?,
      inputTokens: json['inputTokens'] as int?,
      outputTokens: json['outputTokens'] as int?,
      totalTokens: json['totalTokens'] as int?,
      latencyMs: json['latencyMs'] as int?,
      processingVolumeBytes: json['processingVolumeBytes'] as int?,
    );
  }
}

/// Cost estimate metadata.
class WapCostEstimate {
  final double amountUsd;
  final bool isEstimate;
  final String currency;

  WapCostEstimate({
    required this.amountUsd,
    this.isEstimate = true,
    this.currency = 'USD',
  });

  factory WapCostEstimate.fromJson(Map<String, dynamic>? json) {
    if (json == null) return WapCostEstimate(amountUsd: 0.0);
    return WapCostEstimate(
      amountUsd: (json['amountUsd'] as num?)?.toDouble() ?? 0.0,
      isEstimate: json['isEstimate'] as bool? ?? true,
      currency: json['currency'] as String? ?? 'USD',
    );
  }
}

/// Standard response envelope received from WAPCentral Platform API Gateway.
class WapResponse<T> {
  final bool success;
  final String requestId;
  final String appId;
  final String service;
  final String version;
  final T? data;
  final ExecutionSource executionSource;
  final WapUsage? usage;
  final WapCostEstimate? costEstimate;
  final DateTime timestamp;

  WapResponse({
    required this.success,
    required this.requestId,
    required this.appId,
    required this.service,
    required this.version,
    this.data,
    required this.executionSource,
    this.usage,
    this.costEstimate,
    required this.timestamp,
  });
}
