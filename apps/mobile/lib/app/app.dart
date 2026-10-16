import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../core/camera/camera_service.dart';
import '../core/location/location_service.dart';
import '../core/network/api_client.dart';
import '../core/storage/storage_service.dart';
import '../features/auth/controllers/auth_controller.dart';
import '../features/auth/screens/login_screen.dart';
import '../features/auth/services/auth_service.dart';
import '../features/company_selection/controllers/company_controller.dart';
import '../features/company_selection/screens/company_selection_screen.dart';
import '../features/attendance/controllers/attendance_controller.dart';
import '../features/attendance/screens/check_in_screen.dart';
import '../features/attendance/screens/check_out_screen.dart';
import '../features/attendance/services/attendance_service.dart';
import '../features/history/screens/attendance_history_screen.dart';
import '../features/home/screens/home_screen.dart';
import 'router.dart';

class AttendanceApp extends StatefulWidget {
  final IStorageService? storageService;
  final ApiClient? apiClient;
  final ILocationService? locationService;
  final ICameraService? cameraService;
  final AuthController? authController;
  final AttendanceController? attendanceController;

  const AttendanceApp({
    super.key,
    this.storageService,
    this.apiClient,
    this.locationService,
    this.cameraService,
    this.authController,
    this.attendanceController,
  });

  @override
  State<AttendanceApp> createState() => _AttendanceAppState();
}

class _AttendanceAppState extends State<AttendanceApp> {
  late final IStorageService _storageService;
  late final ApiClient _apiClient;
  late final ILocationService _locationService;
  late final ICameraService _cameraService;
  late final AuthService _authService;
  late final AttendanceService _attendanceService;
  late final AuthController _authController;
  late final CompanyController _companyController;
  late final AttendanceController _attendanceController;

  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();

  @override
  void initState() {
    super.initState();
    _storageService = widget.storageService ?? SecureStorageService();
    _apiClient = widget.apiClient ?? ApiClient(storageService: _storageService);
    _locationService = widget.locationService ?? LocationService();
    _cameraService = widget.cameraService ?? _DefaultCameraService();

    _authService = AuthService(apiClient: _apiClient, storageService: _storageService);
    _attendanceService = AttendanceService(apiClient: _apiClient);

    _authController = widget.authController ??
        AuthController(authService: _authService, storageService: _storageService);
    _companyController = CompanyController(authController: _authController);
    _attendanceController = widget.attendanceController ??
        AttendanceController(
          attendanceService: _attendanceService,
          locationService: _locationService,
          cameraService: _cameraService,
        );

    _authController.initialize();
  }

  void _onLoginSuccess() {
    if (_authController.hasActiveCompany) {
      _navigatorKey.currentState?.pushReplacementNamed(AppRoutes.home);
    } else {
      _navigatorKey.currentState?.pushReplacementNamed(AppRoutes.companySelection);
    }
  }

  void _onCompanySelected() {
    _attendanceController.clearTenantState();
    _navigatorKey.currentState?.pushReplacementNamed(AppRoutes.home);
  }

  void _onLogout() async {
    await _authController.logout();
    _attendanceController.clearTenantState();
    _navigatorKey.currentState?.pushNamedAndRemoveUntil(AppRoutes.login, (route) => false);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: _navigatorKey,
      title: 'Employee Attendance',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E40AF),
          primary: const Color(0xFF1E40AF),
        ),
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      home: AnimatedBuilder(
        animation: _authController,
        builder: (context, _) {
          switch (_authController.status) {
            case AuthStatus.uninitialized:
            case AuthStatus.loading:
              return const Scaffold(
                body: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(),
                      SizedBox(height: 16),
                      Text('Initializing Attendance App...'),
                    ],
                  ),
                ),
              );
            case AuthStatus.authenticated:
              if (!_authController.hasActiveCompany) {
                return CompanySelectionScreen(
                  companyController: _companyController,
                  onCompanySelected: _onCompanySelected,
                  onLogout: _onLogout,
                );
              }
              return HomeScreen(
                authController: _authController,
                attendanceController: _attendanceController,
                onNavigateCheckIn: () => _navigatorKey.currentState?.pushNamed(AppRoutes.checkIn),
                onNavigateCheckOut: () => _navigatorKey.currentState?.pushNamed(AppRoutes.checkOut),
                onNavigateHistory: () => _navigatorKey.currentState?.pushNamed(AppRoutes.history),
                onNavigateSwitchCompany: () =>
                    _navigatorKey.currentState?.pushNamed(AppRoutes.companySelection),
                onLogout: _onLogout,
              );
            case AuthStatus.unauthenticated:
            case AuthStatus.error:
              return LoginScreen(
                authController: _authController,
                onLoginSuccess: _onLoginSuccess,
              );
          }
        },
      ),
      routes: {
        AppRoutes.login: (context) => LoginScreen(
              authController: _authController,
              onLoginSuccess: _onLoginSuccess,
            ),
        AppRoutes.companySelection: (context) => CompanySelectionScreen(
              companyController: _companyController,
              onCompanySelected: _onCompanySelected,
              onLogout: _onLogout,
            ),
        AppRoutes.home: (context) => HomeScreen(
              authController: _authController,
              attendanceController: _attendanceController,
              onNavigateCheckIn: () => _navigatorKey.currentState?.pushNamed(AppRoutes.checkIn),
              onNavigateCheckOut: () => _navigatorKey.currentState?.pushNamed(AppRoutes.checkOut),
              onNavigateHistory: () => _navigatorKey.currentState?.pushNamed(AppRoutes.history),
              onNavigateSwitchCompany: () =>
                  _navigatorKey.currentState?.pushNamed(AppRoutes.companySelection),
              onLogout: _onLogout,
            ),
        AppRoutes.checkIn: (context) => CheckInScreen(
              attendanceController: _attendanceController,
              onSuccess: () {
                _navigatorKey.currentState?.pop();
                _attendanceController.refreshToday();
              },
            ),
        AppRoutes.checkOut: (context) => CheckOutScreen(
              attendanceController: _attendanceController,
              onSuccess: () {
                _navigatorKey.currentState?.pop();
                _attendanceController.refreshToday();
              },
            ),
        AppRoutes.history: (context) => AttendanceHistoryScreen(
              attendanceController: _attendanceController,
            ),
      },
    );
  }
}

class _DefaultCameraService implements ICameraService {
  @override
  Future<bool> hasPermission() async => true;

  @override
  Future<bool> requestPermission() async => true;

  @override
  Future<SelfiePhoto> captureSelfie() async {
    // Default fallback placeholder: valid JPEG magic bytes
    final dummyJpegBytes = [
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9,
    ];
    return SelfiePhoto(
      bytes: Uint8List.fromList(dummyJpegBytes),
      mimeType: 'image/jpeg',
      fileName: 'selfie_${DateTime.now().millisecondsSinceEpoch}.jpg',
      fileSizeBytes: dummyJpegBytes.length,
    );
  }
}
