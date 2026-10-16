import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:attendance_mobile/core/camera/camera_service.dart';
import 'package:attendance_mobile/core/errors/app_exceptions.dart';
import 'package:attendance_mobile/core/network/api_client.dart';
import 'package:attendance_mobile/features/attendance/controllers/attendance_controller.dart';
import 'package:attendance_mobile/features/attendance/models/attendance_models.dart';
import 'package:attendance_mobile/features/attendance/services/attendance_service.dart';
import 'mocks/mock_services.dart';

void main() {
  group('Selfie Validation, Upload & Retry Tests', () {
    late MockStorageService mockStorage;
    late MockHttpClient mockHttp;
    late ApiClient apiClient;
    late AttendanceService attendanceService;
    late MockLocationService mockLocation;
    late MockCameraService mockCamera;
    late AttendanceController attendanceController;

    setUp(() {
      mockStorage = MockStorageService();
      mockHttp = MockHttpClient();
      apiClient = ApiClient(
        httpClient: mockHttp,
        storageService: mockStorage,
        baseUrl: 'http://localhost:3000/api/v1',
      );
      attendanceService = AttendanceService(apiClient: apiClient);
      mockLocation = MockLocationService();
      mockCamera = MockCameraService();
      attendanceController = AttendanceController(
        attendanceService: attendanceService,
        locationService: mockLocation,
        cameraService: mockCamera,
      );
    });

    test('Camera permission denial throws CameraAppException', () async {
      mockCamera.hasCamPermission = false;

      expect(
        () => mockCamera.captureSelfie(),
        throwsA(
          predicate((e) =>
              e is CameraAppException && e.type == CameraErrorType.permissionDenied),
        ),
      );
    });

    test('Magic byte detector detects valid JPEG, PNG, and WebP signatures', () {
      final jpegBytes = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01];
      expect(CameraValidationHelper.detectMimeType(jpegBytes), 'image/jpeg');

      final pngBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D];
      expect(CameraValidationHelper.detectMimeType(pngBytes), 'image/png');

      final webpBytes = [
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
      ];
      expect(CameraValidationHelper.detectMimeType(webpBytes), 'image/webp');
    });

    test('Magic byte detector rejects fake or text files', () {
      final fakeBytes = utf8.encode('<html><body>Not an image</body></html>');
      expect(CameraValidationHelper.detectMimeType(fakeBytes), isNull);
    });

    test('Rejects selfie exceeding 5MB size limit', () async {
      final largeBytes = Uint8List(6 * 1024 * 1024); // 6MB
      largeBytes[0] = 0xFF;
      largeBytes[1] = 0xD8;
      largeBytes[2] = 0xFF;

      final photo = SelfiePhoto(
        bytes: largeBytes,
        mimeType: 'image/jpeg',
        fileName: 'huge.jpg',
        fileSizeBytes: largeBytes.length,
      );

      final success = await attendanceController.executeCheckIn(
        location: const WorkLocationModel(
          id: 'loc-1',
          name: 'Main Office',
          latitude: -6.2,
          longitude: 106.8,
          geofenceRadiusM: 100,
          maxGpsAccuracyM: 50,
          isActive: true,
        ),
        selfieOverride: photo,
      );

      expect(success, isFalse);
      expect(attendanceController.errorMessage, contains('exceeds maximum size limit'));
    });

    test('Binary upload retries up to 2 times on network failure', () async {
      int uploadAttempts = 0;

      mockHttp.when('POST', '/api/v1/attendance/selfie-uploads', (req) async {
        return http.Response(
          jsonEncode({
            'data': {
              'uploadId': 'upload-123',
              'uploadUrl': 'http://localhost:3000/api/v1/storage/upload',
              'objectKey': 'tenants/c-1/selfies/upload-123.jpg',
              'expiresInSeconds': 900,
              'maxFileSizeBytes': 5242880,
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      mockHttp.when('PUT', '/api/v1/storage/upload', (req) async {
        uploadAttempts++;
        if (uploadAttempts < 2) {
          // Fail the first attempt
          return http.Response('Network glitch', 503);
        }
        // Succeed on retry
        return http.Response('', 200);
      });

      mockHttp.when('POST', '/api/v1/attendance/selfie-uploads/upload-123/complete', (req) async {
        return http.Response(
          jsonEncode({
            'data': {
              'upload': {
                'id': 'upload-123',
                'status': 'COMPLETED',
              },
              'verified': true,
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      mockHttp.when('POST', '/api/v1/attendance/check-in', (req) async {
        return http.Response(
          jsonEncode({
            'data': {
              'id': 'rec-1',
              'companyId': 'c-1',
              'employeeId': 'emp-1',
              'workDate': '2026-10-16',
              'status': 'IN_PROGRESS',
              'checkInAt': '2026-10-16T08:00:00Z',
              'createdAt': '2026-10-16T08:00:00Z',
              'updatedAt': '2026-10-16T08:00:00Z',
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final success = await attendanceController.executeCheckIn(
        location: const WorkLocationModel(
          id: 'loc-1',
          name: 'Main Office',
          latitude: -6.2,
          longitude: 106.8,
          geofenceRadiusM: 100,
          maxGpsAccuracyM: 50,
          isActive: true,
        ),
      );

      expect(success, isTrue);
      expect(uploadAttempts, 2); // Verified retry occurred
      expect(attendanceController.todayRecord?.status, 'IN_PROGRESS');
    });
  });
}
