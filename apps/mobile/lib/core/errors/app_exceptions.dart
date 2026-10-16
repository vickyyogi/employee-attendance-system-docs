class AppException implements Exception {
  final String message;
  final String? code;
  final dynamic details;

  const AppException(this.message, {this.code, this.details});

  @override
  String toString() => message;
}

class ApiException extends AppException {
  final int statusCode;
  final String? requestId;

  const ApiException({
    required this.statusCode,
    required String message,
    String? code,
    this.requestId,
    dynamic details,
  }) : super(message, code: code, details: details);

  @override
  String toString() => '[$statusCode] $message';
}

class NetworkException extends AppException {
  const NetworkException([String message = 'Network connection failed. Please check your internet connection.'])
      : super(message, code: 'NETWORK_ERROR');
}

class UnauthorizedException extends ApiException {
  const UnauthorizedException({
    String message = 'Authentication required or session expired',
    String? requestId,
  }) : super(statusCode: 401, message: message, code: 'UNAUTHORIZED', requestId: requestId);
}

class ForbiddenException extends ApiException {
  const ForbiddenException({
    String message = 'Access denied. You do not have permission.',
    String? requestId,
  }) : super(statusCode: 403, message: message, code: 'FORBIDDEN', requestId: requestId);
}

class ConflictException extends ApiException {
  const ConflictException({
    required String message,
    String? code,
    String? requestId,
    dynamic details,
  }) : super(statusCode: 409, message: message, code: code ?? 'CONFLICT', requestId: requestId, details: details);
}

class ValidationException extends ApiException {
  const ValidationException({
    required String message,
    String? code,
    String? requestId,
    dynamic details,
  }) : super(statusCode: 422, message: message, code: code ?? 'VALIDATION_ERROR', requestId: requestId, details: details);
}

enum LocationErrorType {
  permissionDenied,
  permissionDeniedForever,
  serviceDisabled,
  accuracyExceeded,
  timeout,
  unknown,
}

class LocationAppException extends AppException {
  final LocationErrorType type;

  const LocationAppException(
    String message, {
    required this.type,
    String? code,
  }) : super(message, code: code ?? 'LOCATION_ERROR');
}

enum CameraErrorType {
  permissionDenied,
  permissionDeniedForever,
  noCameraAvailable,
  captureFailed,
  unknown,
}

class CameraAppException extends AppException {
  final CameraErrorType type;

  const CameraAppException(
    String message, {
    required this.type,
    String? code,
  }) : super(message, code: code ?? 'CAMERA_ERROR');
}
