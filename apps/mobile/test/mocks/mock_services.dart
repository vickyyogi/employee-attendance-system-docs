import 'dart:convert';
import 'dart:typed_data';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:attendance_mobile/core/camera/camera_service.dart';
import 'package:attendance_mobile/core/errors/app_exceptions.dart';
import 'package:attendance_mobile/core/location/location_service.dart';
import 'package:attendance_mobile/core/storage/storage_service.dart';

class MockStorageService implements IStorageService {
  final Map<String, String> _data = {};

  @override
  Future<String?> getAccessToken() async => _data['accessToken'];

  @override
  Future<void> setAccessToken(String token) async => _data['accessToken'] = token;

  @override
  Future<String?> getRefreshToken() async => _data['refreshToken'];

  @override
  Future<void> setRefreshToken(String token) async => _data['refreshToken'] = token;

  @override
  Future<String?> getActiveCompanyId() async => _data['activeCompanyId'];

  @override
  Future<void> setActiveCompanyId(String companyId) async => _data['activeCompanyId'] = companyId;

  @override
  Future<String?> getUserJson() async => _data['userJson'];

  @override
  Future<void> setUserJson(String jsonStr) async => _data['userJson'] = jsonStr;

  @override
  Future<String?> getActiveCompanyJson() async => _data['activeCompanyJson'];

  @override
  Future<void> setActiveCompanyJson(String jsonStr) async => _data['activeCompanyJson'] = jsonStr;

  @override
  Future<void> clearActiveCompany() async {
    _data.remove('activeCompanyId');
    _data.remove('activeCompanyJson');
  }

  @override
  Future<void> clearAuth() async {
    _data.remove('accessToken');
    _data.remove('refreshToken');
    _data.remove('userJson');
    await clearActiveCompany();
  }

  @override
  Future<void> clearAll() async => _data.clear();
}

class MockLocationService implements ILocationService {
  bool serviceEnabled = true;
  LocationPermission permission = LocationPermission.always;
  LocationData? mockLocation = const LocationData(
    latitude: -6.200000,
    longitude: 106.816666,
    accuracyM: 10.0,
  );
  bool shouldThrowException = false;
  LocationAppException? exceptionToThrow;

  @override
  Future<bool> isServiceEnabled() async => serviceEnabled;

  @override
  Future<LocationPermission> checkPermission() async => permission;

  @override
  Future<LocationPermission> requestPermission() async => permission;

  @override
  Future<LocationData> getCurrentLocation({int maxAllowedAccuracyM = 50}) async {
    if (shouldThrowException && exceptionToThrow != null) {
      throw exceptionToThrow!;
    }

    if (!serviceEnabled) {
      throw const LocationAppException(
        'Location services disabled',
        type: LocationErrorType.serviceDisabled,
      );
    }

    if (permission == LocationPermission.denied) {
      throw const LocationAppException(
        'Location permission denied',
        type: LocationErrorType.permissionDenied,
      );
    }

    if (permission == LocationPermission.deniedForever) {
      throw const LocationAppException(
        'Location permission denied forever',
        type: LocationErrorType.permissionDeniedForever,
      );
    }

    if (mockLocation != null && mockLocation!.accuracyM > maxAllowedAccuracyM) {
      throw LocationAppException(
        'GPS accuracy (${mockLocation!.accuracyM}m) exceeds allowable threshold',
        type: LocationErrorType.accuracyExceeded,
      );
    }

    return mockLocation!;
  }
}

class MockCameraService implements ICameraService {
  bool hasCamPermission = true;
  bool shouldThrow = false;
  SelfiePhoto? photoToReturn;

  MockCameraService({this.photoToReturn}) {
    // Default valid JPEG photo
    photoToReturn ??= SelfiePhoto(
      bytes: Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
      mimeType: 'image/jpeg',
      fileName: 'selfie_mock.jpg',
      fileSizeBytes: 12,
    );
  }

  @override
  Future<bool> hasPermission() async => hasCamPermission;

  @override
  Future<bool> requestPermission() async => hasCamPermission;

  @override
  Future<SelfiePhoto> captureSelfie() async {
    if (shouldThrow) {
      throw const CameraAppException('Camera capture failed', type: CameraErrorType.captureFailed);
    }
    if (!hasCamPermission) {
      throw const CameraAppException('Camera permission denied', type: CameraErrorType.permissionDenied);
    }
    return photoToReturn!;
  }
}

typedef HttpHandler = Future<http.Response> Function(http.Request request);

class MockHttpClient extends http.BaseClient {
  final Map<String, HttpHandler> _handlers = {};
  final List<http.Request> recordedRequests = [];

  void when(String method, String path, HttpHandler handler) {
    _handlers['${method.toUpperCase()}:$path'] = handler;
  }

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    if (request is! http.Request) {
      throw UnimplementedError();
    }
    recordedRequests.add(request);

    final key = '${request.method.toUpperCase()}:${request.url.path}';
    final handler = _handlers[key];

    if (handler != null) {
      final response = await handler(request);
      return http.StreamedResponse(
        Stream.value(response.bodyBytes),
        response.statusCode,
        headers: response.headers,
      );
    }

    // Default 404 for unhandled mock paths
    return http.StreamedResponse(
      Stream.value(utf8.encode(jsonEncode({'error': {'message': 'Not found in mock', 'code': 'NOT_FOUND'}}))),
      404,
      headers: {'content-type': 'application/json'},
    );
  }
}
