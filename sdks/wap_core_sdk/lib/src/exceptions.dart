/// Base exception for all WAPCentral SDK errors.
class WapException implements Exception {
  final String code;
  final String message;
  final Map<String, dynamic>? details;

  WapException({
    required this.code,
    required this.message,
    this.details,
  });

  @override
  String toString() => 'WapException [$code]: $message';
}

/// Authentication failed (missing or invalid appKey).
class WapAuthException extends WapException {
  WapAuthException(String message, [Map<String, dynamic>? details])
      : super(code: 'UNAUTHENTICATED', message: message, details: details);
}

/// The application is not authorized to use the requested service.
class WapServiceNotAuthorizedException extends WapException {
  final String requestedService;

  WapServiceNotAuthorizedException({
    required this.requestedService,
    required String message,
    Map<String, dynamic>? details,
  }) : super(code: 'SERVICE_NOT_AUTHORIZED', message: message, details: details);
}

/// Rate limit or daily quota exceeded for the application or service.
class WapQuotaExceededException extends WapException {
  WapQuotaExceededException(String message, [Map<String, dynamic>? details])
      : super(code: 'QUOTA_EXCEEDED', message: message, details: details);
}

/// Service or application has been disabled centrally via Kill Switch.
class WapServiceDisabledException extends WapException {
  WapServiceDisabledException(String message, [Map<String, dynamic>? details])
      : super(code: 'SERVICE_DISABLED', message: message, details: details);
}

/// Network communication or timeout error.
class WapNetworkException extends WapException {
  WapNetworkException(String message, [Map<String, dynamic>? details])
      : super(code: 'NETWORK_ERROR', message: message, details: details);
}

/// Invalid request format or validation rejection.
class WapValidationException extends WapException {
  WapValidationException(String message, [Map<String, dynamic>? details])
      : super(code: 'VALIDATION_ERROR', message: message, details: details);
}
