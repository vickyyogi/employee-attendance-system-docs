import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:attendance_mobile/core/errors/app_exceptions.dart';
import 'package:attendance_mobile/core/network/api_client.dart';
import 'package:attendance_mobile/features/auth/controllers/auth_controller.dart';
import 'package:attendance_mobile/features/auth/services/auth_service.dart';
import 'mocks/mock_services.dart';

void main() {
  group('Auth & Session Tests', () {
    late MockStorageService mockStorage;
    late MockHttpClient mockHttp;
    late ApiClient apiClient;
    late AuthService authService;
    late AuthController authController;

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
    });

    test('Login success stores sensitive tokens and user in secure storage', () async {
      mockHttp.when('POST', '/api/v1/auth/login', (req) async {
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        expect(body['email'], 'john@example.com');
        expect(body['password'], 'secret123');
        return http.Response(
          jsonEncode({
            'data': {
              'user': {
                'id': 'u-123',
                'email': 'john@example.com',
                'fullName': 'John Doe',
                'status': 'ACTIVE',
              },
              'tokens': {
                'accessToken': 'jwt.access.token',
                'refreshToken': 'jwt.refresh.token',
                'expiresIn': '15m',
              },
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      mockHttp.when('GET', '/api/v1/auth/me', (req) async {
        return http.Response(
          jsonEncode({
            'data': {
              'user': {
                'id': 'u-123',
                'email': 'john@example.com',
                'fullName': 'John Doe',
                'status': 'ACTIVE',
              },
              'memberships': [
                {
                  'id': 'm-1',
                  'companyId': 'c-1',
                  'companyName': 'Acme Corp',
                  'companySlug': 'acme',
                  'role': 'EMPLOYEE',
                  'status': 'ACTIVE',
                }
              ],
              'activeCompany': {
                'id': 'c-1',
                'name': 'Acme Corp',
                'slug': 'acme',
                'role': 'EMPLOYEE',
                'permissions': ['attendance.check_in', 'attendance.check_out'],
              },
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final success = await authController.login('john@example.com', 'secret123');

      expect(success, isTrue);
      expect(authController.isAuthenticated, isTrue);
      expect(authController.user?.fullName, 'John Doe');
      expect(authController.activeCompany?.name, 'Acme Corp');

      // Verify tokens stored in secure storage
      expect(await mockStorage.getAccessToken(), 'jwt.access.token');
      expect(await mockStorage.getRefreshToken(), 'jwt.refresh.token');
    });

    test('Login failure returns error without storing tokens', () async {
      mockHttp.when('POST', '/api/v1/auth/login', (req) async {
        return http.Response(
          jsonEncode({
            'error': {
              'code': 'UNAUTHORIZED',
              'message': 'Invalid email or password',
            },
          }),
          401,
          headers: {'content-type': 'application/json'},
        );
      });

      final success = await authController.login('wrong@example.com', 'badpass');

      expect(success, isFalse);
      expect(authController.isAuthenticated, isFalse);
      expect(authController.status, AuthStatus.error);
      expect(authController.errorMessage, contains('Invalid email or password'));
      expect(await mockStorage.getAccessToken(), isNull);
    });

    test('Token expiry (401) triggers automatic refresh and retries request', () async {
      await mockStorage.setAccessToken('expired_access_token');
      await mockStorage.setRefreshToken('valid_refresh_token');

      int attempts = 0;
      mockHttp.when('GET', '/api/v1/attendance/today', (req) async {
        attempts++;
        if (req.headers['authorization'] == 'Bearer expired_access_token') {
          return http.Response(
            jsonEncode({'error': {'code': 'UNAUTHORIZED', 'message': 'Token expired'}}),
            401,
            headers: {'content-type': 'application/json'},
          );
        }
        if (req.headers['authorization'] == 'Bearer new_refreshed_token') {
          return http.Response(
            jsonEncode({'data': null}),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('Unexpected', 500);
      });

      mockHttp.when('POST', '/api/v1/auth/refresh', (req) async {
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        expect(body['refreshToken'], 'valid_refresh_token');
        return http.Response(
          jsonEncode({
            'data': {
              'tokens': {
                'accessToken': 'new_refreshed_token',
                'refreshToken': 'new_refresh_token_2',
              },
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final result = await apiClient.get('/attendance/today');
      expect(result, isNull);
      expect(attempts, 2);
      expect(await mockStorage.getAccessToken(), 'new_refreshed_token');
      expect(await mockStorage.getRefreshToken(), 'new_refresh_token_2');
    });

    test('Token refresh failure clears secure storage and throws UnauthorizedException', () async {
      await mockStorage.setAccessToken('expired_access_token');
      await mockStorage.setRefreshToken('revoked_refresh_token');

      mockHttp.when('GET', '/api/v1/attendance/today', (req) async {
        return http.Response(
          jsonEncode({'error': {'code': 'UNAUTHORIZED', 'message': 'Token expired'}}),
          401,
          headers: {'content-type': 'application/json'},
        );
      });

      mockHttp.when('POST', '/api/v1/auth/refresh', (req) async {
        return http.Response(
          jsonEncode({'error': {'code': 'UNAUTHORIZED', 'message': 'Refresh token revoked'}}),
          401,
          headers: {'content-type': 'application/json'},
        );
      });

      await expectLater(
        apiClient.get('/attendance/today'),
        throwsA(isA<UnauthorizedException>()),
      );

      // Verify credentials were wiped
      expect(await mockStorage.getAccessToken(), isNull);
      expect(await mockStorage.getRefreshToken(), isNull);
    });

    test('Logout revokes refresh token and clears secure storage', () async {
      await mockStorage.setAccessToken('active_token');
      await mockStorage.setRefreshToken('active_refresh');
      await mockStorage.setActiveCompanyId('c-1');

      bool logoutEndpointCalled = false;
      mockHttp.when('POST', '/api/v1/auth/logout', (req) async {
        logoutEndpointCalled = true;
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        expect(body['refreshToken'], 'active_refresh');
        return http.Response(
          jsonEncode({'data': {'revoked': true}}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      await authController.logout();

      expect(logoutEndpointCalled, isTrue);
      expect(authController.isAuthenticated, isFalse);
      expect(await mockStorage.getAccessToken(), isNull);
      expect(await mockStorage.getRefreshToken(), isNull);
      expect(await mockStorage.getActiveCompanyId(), isNull);
    });
  });
}
