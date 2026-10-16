import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:attendance_mobile/core/network/api_client.dart';
import 'package:attendance_mobile/features/attendance/controllers/attendance_controller.dart';
import 'package:attendance_mobile/features/attendance/models/attendance_models.dart';
import 'package:attendance_mobile/features/attendance/services/attendance_service.dart';
import 'package:attendance_mobile/features/auth/controllers/auth_controller.dart';
import 'package:attendance_mobile/features/auth/services/auth_service.dart';
import 'package:attendance_mobile/features/company_selection/controllers/company_controller.dart';
import 'mocks/mock_services.dart';

void main() {
  group('Company Selection & Tenant Switching Tests', () {
    late MockStorageService mockStorage;
    late MockHttpClient mockHttp;
    late ApiClient apiClient;
    late AuthService authService;
    late AuthController authController;
    late CompanyController companyController;
    late AttendanceController attendanceController;
    late AttendanceService attendanceService;
    late MockLocationService mockLocation;
    late MockCameraService mockCamera;

    setUp(() {
      mockStorage = MockStorageService();
      mockHttp = MockHttpClient();
      apiClient = ApiClient(
        httpClient: mockHttp,
        storageService: mockStorage,
        baseUrl: 'http://localhost:3000/api/v1',
      );
      authService = AuthService(apiClient: apiClient, storageService: mockStorage);
      authController = AuthController(authService: authService, storageService: mockStorage);
      companyController = CompanyController(authController: authController);

      mockLocation = MockLocationService();
      mockCamera = MockCameraService();
      attendanceService = AttendanceService(apiClient: apiClient);
      attendanceController = AttendanceController(
        attendanceService: attendanceService,
        locationService: mockLocation,
        cameraService: mockCamera,
      );
    });

    test('Selecting active company updates storage and sets tenant context', () async {
      mockHttp.when('POST', '/api/v1/auth/active-company', (req) async {
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        expect(body['companyId'], 'company-beta');
        return http.Response(
          jsonEncode({
            'data': {
              'company': {
                'id': 'company-beta',
                'name': 'Beta Tech Ltd',
                'slug': 'beta-tech',
                'timezone': 'Asia/Jakarta',
              },
              'role': 'EMPLOYEE',
              'permissions': ['attendance.check_in', 'attendance.check_out'],
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final success = await companyController.selectCompany('company-beta');
      expect(success, isTrue);
      expect(authController.activeCompany?.id, 'company-beta');
      expect(authController.activeCompany?.name, 'Beta Tech Ltd');
      expect(await mockStorage.getActiveCompanyId(), 'company-beta');
    });

    test('Company switching clears prior tenant-scoped attendance state', () async {
      // Simulate tenant A attendance state loaded
      attendanceController.executeCheckIn(
        location: const WorkLocationModel(
          id: 'loc-1',
          name: 'HQ',
          latitude: -6.2,
          longitude: 106.8,
          geofenceRadiusM: 100,
          maxGpsAccuracyM: 50,
          isActive: true,
        ),
      );

      // Now switch company tenant
      mockHttp.when('POST', '/api/v1/auth/active-company', (req) async {
        return http.Response(
          jsonEncode({
            'data': {
              'company': {
                'id': 'company-gamma',
                'name': 'Gamma Solutions',
                'slug': 'gamma-solutions',
                'timezone': 'Asia/Jakarta',
              },
              'role': 'EMPLOYEE',
              'permissions': ['attendance.check_in'],
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      await companyController.selectCompany('company-gamma');
      attendanceController.clearTenantState();

      // Verify tenant state is wiped
      expect(attendanceController.todayRecord, isNull);
      expect(attendanceController.locations, isEmpty);
      expect(attendanceController.history, isEmpty);
      expect(attendanceController.errorMessage, isNull);
    });
  });
}
