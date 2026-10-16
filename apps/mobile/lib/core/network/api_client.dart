import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../errors/app_exceptions.dart';
import '../storage/storage_service.dart';

class ApiClient {
  final http.Client _httpClient;
  final IStorageService _storageService;
  final String _baseUrl;

  bool _isRefreshing = false;

  ApiClient({
    http.Client? httpClient,
    required IStorageService storageService,
    String? baseUrl,
  })  : _httpClient = httpClient ?? http.Client(),
        _storageService = storageService,
        _baseUrl = baseUrl ?? ApiConfig.baseUrl;

  String get baseUrl => _baseUrl;

  Future<Map<String, String>> _buildHeaders({
    bool includeAuth = true,
    bool includeCompany = true,
    Map<String, String>? extraHeaders,
  }) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (includeAuth) {
      final token = await _storageService.getAccessToken();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    if (includeCompany) {
      final companyId = await _storageService.getActiveCompanyId();
      if (companyId != null && companyId.isNotEmpty) {
        headers['X-Company-Id'] = companyId;
      }
    }

    if (extraHeaders != null) {
      headers.addAll(extraHeaders);
    }

    return headers;
  }

  Future<dynamic> get(
    String endpoint, {
    Map<String, String>? queryParams,
    bool includeAuth = true,
    bool includeCompany = true,
  }) async {
    final uri = _buildUri(endpoint, queryParams);
    return _sendWithRetry(() async {
      final headers = await _buildHeaders(
        includeAuth: includeAuth,
        includeCompany: includeCompany,
      );
      return _httpClient.get(uri, headers: headers).timeout(ApiConfig.connectTimeout);
    });
  }

  Future<dynamic> post(
    String endpoint, {
    dynamic body,
    bool includeAuth = true,
    bool includeCompany = true,
    Map<String, String>? extraHeaders,
  }) async {
    final uri = _buildUri(endpoint);
    final isAuth = endpoint.contains('/auth/login') || endpoint.contains('/auth/refresh');
    return _sendWithRetry(
      () async {
        final headers = await _buildHeaders(
          includeAuth: includeAuth,
          includeCompany: includeCompany,
          extraHeaders: extraHeaders,
        );
        return _httpClient
            .post(uri, headers: headers, body: body != null ? jsonEncode(body) : null)
            .timeout(ApiConfig.connectTimeout);
      },
      isAuthEndpoint: isAuth,
    );
  }

  Future<dynamic> put(
    String endpoint, {
    dynamic body,
    bool includeAuth = true,
    bool includeCompany = true,
  }) async {
    final uri = _buildUri(endpoint);
    return _sendWithRetry(() async {
      final headers = await _buildHeaders(
        includeAuth: includeAuth,
        includeCompany: includeCompany,
      );
      return _httpClient
          .put(uri, headers: headers, body: body != null ? jsonEncode(body) : null)
          .timeout(ApiConfig.connectTimeout);
    });
  }

  Future<dynamic> patch(
    String endpoint, {
    dynamic body,
    bool includeAuth = true,
    bool includeCompany = true,
  }) async {
    final uri = _buildUri(endpoint);
    return _sendWithRetry(() async {
      final headers = await _buildHeaders(
        includeAuth: includeAuth,
        includeCompany: includeCompany,
      );
      return _httpClient
          .patch(uri, headers: headers, body: body != null ? jsonEncode(body) : null)
          .timeout(ApiConfig.connectTimeout);
    });
  }

  /// Direct binary upload (for pre-signed URLs or direct upload storage endpoints)
  Future<void> uploadBinary({
    required String url,
    required List<int> bytes,
    required String contentType,
    Map<String, String>? extraHeaders,
  }) async {
    try {
      final uri = Uri.parse(url.startsWith('http') ? url : '$_baseUrl$url');
      final headers = <String, String>{
        'Content-Type': contentType,
        ...?extraHeaders,
      };

      // Depending on whether pre-signed uses PUT or POST
      final response = await _httpClient
          .put(uri, headers: headers, body: bytes)
          .timeout(ApiConfig.connectTimeout);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiException(
          statusCode: response.statusCode,
          message: 'Failed to upload binary file (status ${response.statusCode})',
        );
      }
    } on SocketException {
      throw const NetworkException('Network error during upload');
    } on TimeoutException {
      throw const NetworkException('Upload timed out');
    }
  }

  Uri _buildUri(String endpoint, [Map<String, String>? queryParams]) {
    final path = endpoint.startsWith('/') ? endpoint : '/$endpoint';
    final fullUrl = '$_baseUrl$path';
    final baseUri = Uri.parse(fullUrl);
    if (queryParams == null || queryParams.isEmpty) {
      return baseUri;
    }
    return baseUri.replace(queryParameters: queryParams);
  }

  Future<dynamic> _sendWithRetry(
    Future<http.Response> Function() requestFn, {
    bool isAuthEndpoint = false,
  }) async {
    try {
      final response = await requestFn();
      return await _handleResponse(response, requestFn, isAuthEndpoint: isAuthEndpoint);
    } on SocketException {
      throw const NetworkException();
    } on TimeoutException {
      throw const NetworkException('Request timed out');
    }
  }

  Future<dynamic> _handleResponse(
    http.Response response,
    Future<http.Response> Function() retryRequestFn, {
    bool isAuthEndpoint = false,
  }) async {
    final statusCode = response.statusCode;

    // Handle 401 Unauthorized with token refresh (non-auth endpoints only)
    if (statusCode == 401 && !isAuthEndpoint) {
      if (!_isRefreshing) {
        final refreshed = await _attemptRefreshToken();
        if (refreshed) {
          final retryResponse = await retryRequestFn();
          return _parseResponseBody(retryResponse);
        }
      }
      await _storageService.clearAuth();
      throw const UnauthorizedException();
    }

    return _parseResponseBody(response);
  }

  dynamic _parseResponseBody(http.Response response) {
    final statusCode = response.statusCode;
    dynamic json;
    try {
      if (response.body.isNotEmpty) {
        json = jsonDecode(response.body);
      }
    } catch (_) {
      // Non-JSON response
    }

    if (statusCode >= 200 && statusCode < 300) {
      if (json is Map<String, dynamic> && json.containsKey('data')) {
        return json['data'];
      }
      return json;
    }

    // Parse standard error envelope: { "error": { "code", "message", "details", "requestId" } }
    String message = 'Request failed with status $statusCode';
    String? code;
    String? requestId;
    dynamic details;

    if (json is Map<String, dynamic> && json.containsKey('error')) {
      final errorMap = json['error'] as Map<String, dynamic>;
      message = errorMap['message'] as String? ?? message;
      code = errorMap['code'] as String?;
      requestId = errorMap['requestId'] as String?;
      details = errorMap['details'];
    }

    if (statusCode == 401) {
      throw UnauthorizedException(message: message, requestId: requestId);
    } else if (statusCode == 403) {
      throw ForbiddenException(message: message, requestId: requestId);
    } else if (statusCode == 409) {
      throw ConflictException(message: message, code: code, requestId: requestId, details: details);
    } else if (statusCode == 422) {
      throw ValidationException(message: message, code: code, requestId: requestId, details: details);
    } else {
      throw ApiException(
        statusCode: statusCode,
        message: message,
        code: code,
        requestId: requestId,
        details: details,
      );
    }
  }

  Future<bool> _attemptRefreshToken() async {
    _isRefreshing = true;
    try {
      final refreshToken = await _storageService.getRefreshToken();
      if (refreshToken == null || refreshToken.isEmpty) {
        return false;
      }

      final uri = _buildUri('/auth/refresh');
      final response = await _httpClient.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': refreshToken}),
      ).timeout(ApiConfig.connectTimeout);

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final data = body['data'] as Map<String, dynamic>;
        final tokens = data['tokens'] as Map<String, dynamic>;
        final newAccess = tokens['accessToken'] as String;
        final newRefresh = tokens['refreshToken'] as String?;

        await _storageService.setAccessToken(newAccess);
        if (newRefresh != null) {
          await _storageService.setRefreshToken(newRefresh);
        }
        return true;
      }
      return false;
    } catch (_) {
      return false;
    } finally {
      _isRefreshing = false;
    }
  }
}
