import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:attendance_mobile/core/network/api_client.dart';
import 'package:attendance_mobile/core/widgets/status_badge.dart';
import 'package:attendance_mobile/features/attendance/controllers/attendance_controller.dart';
import 'package:attendance_mobile/features/attendance/services/attendance_service.dart';
import 'package:attendance_mobile/features/auth/controllers/auth_controller.dart';
import 'package:attendance_mobile/features/auth/screens/login_screen.dart';
import 'package:attendance_mobile/features/auth/services/auth_service.dart';
import 'package:attendance_mobile/features/home/screens/home_screen.dart';
import 'mocks/mock_services.dart';

void main() {
  group('Widget Tests', () {
    late MockStorageService mockStorage;
    late MockHttpClient mockHttp;
    late ApiClient apiClient;
    late AuthService authService;
    late AuthController authController;
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
      authService = AuthService(apiClient: apiClient, storageService: mockStorage);
      authController = AuthController(authService: authService, storageService: mockStorage);
      mockLocation = MockLocationService();
      mockCamera = MockCameraService();
      attendanceService = AttendanceService(apiClient: apiClient);
      attendanceController = AttendanceController(
        attendanceService: attendanceService,
        locationService: mockLocation,
        cameraService: mockCamera,
      );
    });

    testWidgets('LoginScreen renders email, password fields and sign-in button', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: LoginScreen(
            authController: authController,
            onLoginSuccess: () {},
          ),
        ),
      );

      expect(find.text('Employee Attendance'), findsOneWidget);
      expect(find.byType(TextFormField), findsNWidgets(2));
      expect(find.text('Sign In'), findsOneWidget);
    });

    testWidgets('StatusBadge renders appropriate labels for different statuses', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                StatusBadge(status: 'PRESENT'),
                StatusBadge(status: 'LATE'),
                StatusBadge(status: 'IN_PROGRESS'),
                StatusBadge(status: 'FLAGGED'),
              ],
            ),
          ),
        ),
      );

      expect(find.text('Present'), findsOneWidget);
      expect(find.text('Late'), findsOneWidget);
      expect(find.text('In Progress'), findsOneWidget);
      expect(find.text('Flagged'), findsOneWidget);
    });

    testWidgets('HomeScreen renders Clock In button when no record exists for today', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: HomeScreen(
            authController: authController,
            attendanceController: attendanceController,
            onNavigateCheckIn: () {},
            onNavigateCheckOut: () {},
            onNavigateHistory: () {},
            onNavigateSwitchCompany: () {},
            onLogout: () {},
          ),
        ),
      );

      await tester.pump();

      expect(find.text("Today's Attendance"), findsOneWidget);
      expect(find.text('Not Checked In Yet'), findsOneWidget);
      expect(find.text('Clock In Now'), findsOneWidget);
    });
  });
}
