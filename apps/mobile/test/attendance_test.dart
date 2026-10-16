import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:attendance_mobile/core/network/api_client.dart';
import 'package:attendance_mobile/features/attendance/controllers/attendance_controller.dart';
import 'package:attendance_mobile/features/attendance/models/attendance_models.dart';
import 'package:attendance_mobile/features/attendance/services/attendance_service.dart';
import 'mocks/mock_services.dart';

void main() {
  group('Attendance Flow & Invariant Tests', () {
    late MockStorageService mockStorage;
    late MockHttpClient mockHttp;
    late ApiClient apiClient;
    late AttendanceService attendanceService;
    late MockLocationService mockLocation;
    late MockCameraService mockCamera;
    late AttendanceController attendanceController;

    const testLocation = WorkLocationModel(
      id: 'loc-1',
      name: 'Central HQ',
      address: 'Jl. Sudirman No. 1',
      latitude: -6.2088,
      longitude: 106.8456,
      geofenceRadiusM: 100,
      maxGpsAccuracyM: 50,
      isActive: true,
    );

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

    test('Check-in success path produces valid record and updates state', () async {
      mockHttp.when('POST', '/api/v1/attendance/selfie-uploads', (req) async {
        return http.Response(
          jsonEncode({
            'data': {
              'uploadId': 'u-1',
              'uploadUrl': 'http://localhost:3000/api/v1/storage/upload/u-1',
              'objectKey': 'tenants/c-1/selfies/u-1.jpg',
              'expiresInSeconds': 900,
              'maxFileSizeBytes': 5242880,
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      mockHttp.when('PUT', '/api/v1/storage/upload/u-1', (req) async {
        return http.Response('', 200);
      });

      mockHttp.when('POST', '/api/v1/attendance/selfie-uploads/u-1/complete', (req) async {
        return http.Response(
          jsonEncode({
            'data': {
              'upload': {'id': 'u-1', 'status': 'COMPLETED'},
              'verified': true,
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      mockHttp.when('POST', '/api/v1/attendance/check-in', (req) async {
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        expect(body['workLocationId'], 'loc-1');
        expect(body['selfieUploadId'], 'u-1');
        expect(body['idempotencyKey'], isNotEmpty);

        return http.Response(
          jsonEncode({
            'data': {
              'id': 'att-1',
              'companyId': 'comp-1',
              'employeeId': 'emp-1',
              'workDate': '2026-10-16',
              'workLocationId': 'loc-1',
              'workLocation': {'id': 'loc-1', 'name': 'Central HQ'},
              'checkInAt': '2026-10-16T08:00:00Z',
              'checkInLatitude': -6.2088,
              'checkInLongitude': 106.8456,
              'checkInAccuracyM': 10,
              'checkInGeofenceValid': true,
              'status': 'IN_PROGRESS',
              'createdAt': '2026-10-16T08:00:00Z',
              'updatedAt': '2026-10-16T08:00:00Z',
            },
          }),
          201,
          headers: {'content-type': 'application/json'},
        );
      });

      final success = await attendanceController.executeCheckIn(location: testLocation);

      expect(success, isTrue);
      expect(attendanceController.todayRecord?.status, 'IN_PROGRESS');
      expect(attendanceController.todayRecord?.isCheckedIn, isTrue);
      expect(attendanceController.todayRecord?.isCheckedOut, isFalse);
      expect(attendanceController.canCheckOut, isTrue);
    });

    test('Check-out success path updates record to PRESENT or derived status', () async {
      mockHttp.when('POST', '/api/v1/attendance/check-out', (req) async {
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        expect(body['idempotencyKey'], isNotEmpty);

        return http.Response(
          jsonEncode({
            'data': {
              'id': 'att-1',
              'companyId': 'comp-1',
              'employeeId': 'emp-1',
              'workDate': '2026-10-16',
              'workLocationId': 'loc-1',
              'checkInAt': '2026-10-16T08:00:00Z',
              'checkOutAt': '2026-10-16T17:00:00Z',
              'status': 'PRESENT',
              'createdAt': '2026-10-16T08:00:00Z',
              'updatedAt': '2026-10-16T17:00:00Z',
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final success = await attendanceController.executeCheckOut(location: testLocation);

      expect(success, isTrue);
      expect(attendanceController.todayRecord?.status, 'PRESENT');
      expect(attendanceController.todayRecord?.isCheckedOut, isTrue);
      expect(attendanceController.canCheckOut, isFalse);
    });

    test('Duplicate submission prevention blocks concurrent check-in taps', () async {
      // Simulate slow network on upload intent
      mockHttp.when('POST', '/api/v1/attendance/selfie-uploads', (req) async {
        await Future.delayed(const Duration(milliseconds: 100));
        return http.Response(
          jsonEncode({
            'data': {
              'uploadId': 'u-1',
              'uploadUrl': 'http://localhost:3000/api/v1/storage/upload/u-1',
              'objectKey': 'tenants/c-1/selfies/u-1.jpg',
              'expiresInSeconds': 900,
              'maxFileSizeBytes': 5242880,
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      mockHttp.when('PUT', '/api/v1/storage/upload/u-1', (req) async => http.Response('', 200));
      mockHttp.when('POST', '/api/v1/attendance/selfie-uploads/u-1/complete',
          (req) async => http.Response(jsonEncode({'data': {'verified': true}}), 200));

      mockHttp.when('POST', '/api/v1/attendance/check-in', (req) async {
        return http.Response(
          jsonEncode({
            'data': {
              'id': 'att-1',
              'companyId': 'comp-1',
              'employeeId': 'emp-1',
              'workDate': '2026-10-16',
              'status': 'IN_PROGRESS',
              'createdAt': '2026-10-16T08:00:00Z',
              'updatedAt': '2026-10-16T08:00:00Z',
            },
          }),
          201,
        );
      });

      // Launch first check-in
      final firstAttempt = attendanceController.executeCheckIn(location: testLocation);
      // Immediately try to launch second check-in while first is in-flight
      final secondAttempt = await attendanceController.executeCheckIn(location: testLocation);

      expect(secondAttempt, isFalse); // Blocked by isSubmitting guard!
      final firstSuccess = await firstAttempt;
      expect(firstSuccess, isTrue);
    });

    test('Server conflict response (409) is parsed and saved to conflictMessage', () async {
      mockHttp.when('POST', '/api/v1/attendance/selfie-uploads', (req) async {
        return http.Response(
          jsonEncode({
            'data': {
              'uploadId': 'u-1',
              'uploadUrl': 'http://localhost:3000/api/v1/storage/upload/u-1',
              'objectKey': 'k.jpg',
              'expiresInSeconds': 900,
              'maxFileSizeBytes': 5242880,
            },
          }),
          200,
        );
      });
      mockHttp.when('PUT', '/api/v1/storage/upload/u-1', (req) async => http.Response('', 200));
      mockHttp.when('POST', '/api/v1/attendance/selfie-uploads/u-1/complete',
          (req) async => http.Response(jsonEncode({'data': {'verified': true}}), 200));

      mockHttp.when('POST', '/api/v1/attendance/check-in', (req) async {
        return http.Response(
          jsonEncode({
            'error': {
              'code': 'CONFLICT',
              'message': 'Attendance already recorded for this work date',
            },
          }),
          409,
          headers: {'content-type': 'application/json'},
        );
      });

      final success = await attendanceController.executeCheckIn(location: testLocation);

      expect(success, isFalse);
      expect(
        attendanceController.conflictMessage,
        'Attendance already recorded for this work date',
      );
    });

    test('Geofence validation error (422) is parsed into errorMessage', () async {
      mockHttp.when('POST', '/api/v1/attendance/selfie-uploads', (req) async {
        return http.Response(
          jsonEncode({
            'data': {
              'uploadId': 'u-1',
              'uploadUrl': 'http://localhost:3000/api/v1/storage/upload/u-1',
              'objectKey': 'k.jpg',
              'expiresInSeconds': 900,
              'maxFileSizeBytes': 5242880,
            },
          }),
          200,
        );
      });
      mockHttp.when('PUT', '/api/v1/storage/upload/u-1', (req) async => http.Response('', 200));
      mockHttp.when('POST', '/api/v1/attendance/selfie-uploads/u-1/complete',
          (req) async => http.Response(jsonEncode({'data': {'verified': true}}), 200));

      mockHttp.when('POST', '/api/v1/attendance/check-in', (req) async {
        return http.Response(
          jsonEncode({
            'error': {
              'code': 'OUTSIDE_GEOFENCE',
              'message': 'Outside geofence radius (distance: 450m, allowed: 100m)',
            },
          }),
          422,
          headers: {'content-type': 'application/json'},
        );
      });

      final success = await attendanceController.executeCheckIn(location: testLocation);

      expect(success, isFalse);
      expect(
        attendanceController.errorMessage,
        contains('Outside geofence radius'),
      );
    });

    test('Loads attendance history successfully', () async {
      mockHttp.when('GET', '/api/v1/attendance/mine', (req) async {
        return http.Response(
          jsonEncode({
            'data': {
              'records': [
                {
                  'id': 'att-1',
                  'companyId': 'c-1',
                  'employeeId': 'e-1',
                  'workDate': '2026-10-15',
                  'checkInAt': '2026-10-15T08:05:00Z',
                  'checkOutAt': '2026-10-15T17:02:00Z',
                  'status': 'PRESENT',
                  'createdAt': '2026-10-15T08:05:00Z',
                  'updatedAt': '2026-10-15T17:02:00Z',
                },
                {
                  'id': 'att-2',
                  'companyId': 'c-1',
                  'employeeId': 'e-1',
                  'workDate': '2026-10-14',
                  'checkInAt': '2026-10-14T08:45:00Z',
                  'checkOutAt': '2026-10-14T17:00:00Z',
                  'status': 'LATE',
                  'createdAt': '2026-10-14T08:45:00Z',
                  'updatedAt': '2026-10-14T17:00:00Z',
                },
              ],
              'total': 2,
              'page': 1,
              'pageSize': 20,
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      await attendanceController.loadHistory();

      expect(attendanceController.history.length, 2);
      expect(attendanceController.history[0].status, 'PRESENT');
      expect(attendanceController.history[1].status, 'LATE');
    });
  });
}
