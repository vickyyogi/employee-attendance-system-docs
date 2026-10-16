import 'dart:convert';
import '../../../core/network/api_client.dart';
import '../../../core/storage/storage_service.dart';
import '../models/user_model.dart';
import '../../company_selection/models/company_membership_model.dart';

class AuthMeData {
  final UserModel user;
  final List<CompanyMembershipModel> memberships;
  final ActiveCompanyModel? activeCompany;

  const AuthMeData({
    required this.user,
    required this.memberships,
    this.activeCompany,
  });
}

class AuthService {
  final ApiClient _apiClient;
  final IStorageService _storageService;

  AuthService({
    required ApiClient apiClient,
    required IStorageService storageService,
  })  : _apiClient = apiClient,
        _storageService = storageService;

  Future<AuthResult> login(String email, String password) async {
    final response = await _apiClient.post(
      '/auth/login',
      body: {'email': email.trim(), 'password': password},
      includeAuth: false,
      includeCompany: false,
    );

    final result = AuthResult.fromJson(response as Map<String, dynamic>);

    await _storageService.setAccessToken(result.tokens.accessToken);
    await _storageService.setRefreshToken(result.tokens.refreshToken);
    await _storageService.setUserJson(jsonEncode(result.user.toJson()));

    return result;
  }

  Future<AuthMeData> getMe() async {
    final response = await _apiClient.get(
      '/auth/me',
      includeAuth: true,
      includeCompany: false,
    );

    final data = response as Map<String, dynamic>;
    final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
    final membershipsList = (data['memberships'] as List<dynamic>? ?? [])
        .map((m) => CompanyMembershipModel.fromJson(m as Map<String, dynamic>))
        .toList();

    ActiveCompanyModel? activeCompany;
    if (data['activeCompany'] != null) {
      activeCompany = ActiveCompanyModel.fromJson(data['activeCompany'] as Map<String, dynamic>);
    }

    await _storageService.setUserJson(jsonEncode(user.toJson()));
    if (activeCompany != null) {
      await _storageService.setActiveCompanyId(activeCompany.id);
      await _storageService.setActiveCompanyJson(jsonEncode(activeCompany.toJson()));
    }

    return AuthMeData(
      user: user,
      memberships: membershipsList,
      activeCompany: activeCompany,
    );
  }

  Future<ActiveCompanyModel> selectActiveCompany(String companyId) async {
    final response = await _apiClient.post(
      '/auth/active-company',
      body: {'companyId': companyId},
      includeAuth: true,
      includeCompany: false,
    );

    final data = response as Map<String, dynamic>;
    ActiveCompanyModel activeCompany;

    if (data['activeCompany'] != null && data['activeCompany'] is Map<String, dynamic>) {
      activeCompany = ActiveCompanyModel.fromJson(data['activeCompany'] as Map<String, dynamic>);
    } else if (data['company'] != null && data['company'] is Map<String, dynamic>) {
      final companyData = data['company'] as Map<String, dynamic>;
      activeCompany = ActiveCompanyModel(
        id: companyData['id'] as String,
        name: companyData['name'] as String,
        slug: companyData['slug'] as String,
        role: data['role'] as String? ?? 'EMPLOYEE',
        permissions: (data['permissions'] as List<dynamic>?)?.map((p) => p.toString()).toList() ?? [],
        timezone: companyData['timezone'] as String? ?? 'Asia/Jakarta',
      );
    } else {
      activeCompany = ActiveCompanyModel.fromJson(data);
    }

    if (data['accessToken'] is String) {
      await _storageService.setAccessToken(data['accessToken'] as String);
    }

    await _storageService.setActiveCompanyId(activeCompany.id);
    await _storageService.setActiveCompanyJson(jsonEncode(activeCompany.toJson()));

    return activeCompany;
  }

  Future<void> logout() async {
    try {
      final refreshToken = await _storageService.getRefreshToken();
      if (refreshToken != null && refreshToken.isNotEmpty) {
        await _apiClient.post(
          '/auth/logout',
          body: {'refreshToken': refreshToken},
          includeAuth: true,
          includeCompany: false,
        );
      }
    } catch (_) {
      // Ignore network errors on logout to ensure local clear succeeds
    } finally {
      await _storageService.clearAuth();
    }
  }
}
