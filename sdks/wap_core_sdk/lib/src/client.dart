import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'config.dart';
import 'exceptions.dart';
import 'models.dart';

/// Central HTTP Client for communicating with WAPCentral Platform Services.
class WapClient {
  final WapConfig config;
  final http.Client _httpClient;

  WapClient({
    required this.config,
    http.Client? httpClient,
  }) : _httpClient = httpClient ?? http.Client();

  /// Closes the underlying HTTP client.
  void close() {
    _httpClient.close();
  }

  /// Sends a POST request to a platform service endpoint with automatic auth,
  /// request ID tracking, timeout, and retry handling.
  Future<WapResponse<T>> post<T>({
    required String path,
    required Map<String, dynamic> body,
    required T Function(dynamic data) dataParser,
  }) async {
    final url = Uri.parse('${config.baseUrl}$path');
    final requestId = 'req_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(99999)}';

    final headers = {
      'Content-Type': 'application/json',
      'X-App-Id': config.appId,
      'X-App-Key': config.appKey,
      'X-Request-Id': requestId,
      'X-SDK-Version': config.sdkVersion,
      'X-Environment': config.environment,
    };

    final requestBody = {
      'appId': config.appId,
      'requestId': requestId,
      ...body,
    };

    int attempts = 0;
    http.Response? response;
    Exception? lastException;

    while (attempts <= config.maxRetries) {
      attempts++;
      try {
        response = await _httpClient
            .post(
              url,
              headers: headers,
              body: jsonEncode(requestBody),
            )
            .timeout(Duration(milliseconds: config.timeoutMs));

        // If server error (502, 503, 504), retry if attempts left
        if (response.statusCode >= 500 && attempts <= config.maxRetries) {
          await Future.delayed(Duration(milliseconds: 300 * attempts));
          continue;
        }

        break;
      } on Exception catch (e) {
        lastException = e;
        if (attempts <= config.maxRetries) {
          await Future.delayed(Duration(milliseconds: 300 * attempts));
          continue;
        }
        throw WapNetworkException('Failed to communicate with WAPCentral: $e');
      }
    }

    if (response == null) {
      throw WapNetworkException('No response received from WAPCentral ($lastException)');
    }

    return _processResponse<T>(response, requestId, dataParser);
  }

  /// Sends a GET request to a platform endpoint.
  Future<WapResponse<T>> get<T>({
    required String path,
    required T Function(dynamic data) dataParser,
  }) async {
    final url = Uri.parse('${config.baseUrl}$path');
    final requestId = 'req_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(99999)}';

    final headers = {
      'X-App-Id': config.appId,
      'X-App-Key': config.appKey,
      'X-Request-Id': requestId,
      'X-SDK-Version': config.sdkVersion,
      'X-Environment': config.environment,
    };

    try {
      final response = await _httpClient
          .get(url, headers: headers)
          .timeout(Duration(milliseconds: config.timeoutMs));

      return _processResponse<T>(response, requestId, dataParser);
    } catch (e) {
      throw WapNetworkException('Failed GET request to $path: $e');
    }
  }

  /// Parses HTTP response into typed WapResponse or throws specific WapException.
  WapResponse<T> _processResponse<T>(
    http.Response response,
    String fallbackRequestId,
    T Function(dynamic data) dataParser,
  ) {
    Map<String, dynamic> json;
    try {
      json = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw WapException(
        code: 'INVALID_RESPONSE',
        message: 'Platform returned non-JSON response (HTTP ${response.statusCode})',
      );
    }

    final success = json['success'] as bool? ?? false;
    final requestId = json['requestId'] as String? ?? fallbackRequestId;
    final appId = json['appId'] as String? ?? config.appId;
    final service = json['service'] as String? ?? 'platform';
    final version = json['version'] as String? ?? 'v1';

    if (!success || response.statusCode >= 400) {
      final err = json['error'] as Map<String, dynamic>?;
      final code = err?['code'] as String? ?? 'ERROR_${response.statusCode}';
      final message = err?['message'] as String? ?? 'Operation failed';
      final details = err?['details'] as Map<String, dynamic>?;

      switch (response.statusCode) {
        case 401:
          throw WapAuthException(message, details);
        case 403:
          if (code == 'SERVICE_NOT_AUTHORIZED') {
            throw WapServiceNotAuthorizedException(
              requestedService: service,
              message: message,
              details: details,
            );
          }
          throw WapAuthException(message, details);
        case 429:
          throw WapQuotaExceededException(message, details);
        case 503:
          throw WapServiceDisabledException(message, details);
        case 400:
          throw WapValidationException(message, details);
        default:
          throw WapException(code: code, message: message, details: details);
      }
    }

    final rawData = json['data'];
    final data = rawData != null ? dataParser(rawData) : null;
    final executionSource = parseExecutionSource(json['executionSource'] as String?);
    final usage = WapUsage.fromJson(json['usage'] as Map<String, dynamic>?);
    final costEstimate = WapCostEstimate.fromJson(json['costEstimate'] as Map<String, dynamic>?);
    final tsStr = json['timestamp'] as String?;
    final timestamp = tsStr != null ? DateTime.tryParse(tsStr) ?? DateTime.now() : DateTime.now();

    return WapResponse<T>(
      success: true,
      requestId: requestId,
      appId: appId,
      service: service,
      version: version,
      data: data,
      executionSource: executionSource,
      usage: usage,
      costEstimate: costEstimate,
      timestamp: timestamp,
    );
  }
}
