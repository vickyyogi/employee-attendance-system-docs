import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract class IStorageService {
  Future<String?> getAccessToken();
  Future<void> setAccessToken(String token);

  Future<String?> getRefreshToken();
  Future<void> setRefreshToken(String token);

  Future<String?> getActiveCompanyId();
  Future<void> setActiveCompanyId(String companyId);

  Future<String?> getUserJson();
  Future<void> setUserJson(String jsonStr);

  Future<String?> getActiveCompanyJson();
  Future<void> setActiveCompanyJson(String jsonStr);

  Future<void> clearActiveCompany();
  Future<void> clearAuth();
  Future<void> clearAll();
}

class SecureStorageService implements IStorageService {
  final FlutterSecureStorage _storage;

  static const String _keyAccessToken = 'auth_access_token';
  static const String _keyRefreshToken = 'auth_refresh_token';
  static const String _keyActiveCompanyId = 'active_company_id';
  static const String _keyUserJson = 'auth_user_json';
  static const String _keyActiveCompanyJson = 'active_company_json';

  SecureStorageService({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
            );

  @override
  Future<String?> getAccessToken() => _storage.read(key: _keyAccessToken);

  @override
  Future<void> setAccessToken(String token) => _storage.write(key: _keyAccessToken, value: token);

  @override
  Future<String?> getRefreshToken() => _storage.read(key: _keyRefreshToken);

  @override
  Future<void> setRefreshToken(String token) => _storage.write(key: _keyRefreshToken, value: token);

  @override
  Future<String?> getActiveCompanyId() => _storage.read(key: _keyActiveCompanyId);

  @override
  Future<void> setActiveCompanyId(String companyId) =>
      _storage.write(key: _keyActiveCompanyId, value: companyId);

  @override
  Future<String?> getUserJson() => _storage.read(key: _keyUserJson);

  @override
  Future<void> setUserJson(String jsonStr) => _storage.write(key: _keyUserJson, value: jsonStr);

  @override
  Future<String?> getActiveCompanyJson() => _storage.read(key: _keyActiveCompanyJson);

  @override
  Future<void> setActiveCompanyJson(String jsonStr) =>
      _storage.write(key: _keyActiveCompanyJson, value: jsonStr);

  @override
  Future<void> clearActiveCompany() async {
    await _storage.delete(key: _keyActiveCompanyId);
    await _storage.delete(key: _keyActiveCompanyJson);
  }

  @override
  Future<void> clearAuth() async {
    await _storage.delete(key: _keyAccessToken);
    await _storage.delete(key: _keyRefreshToken);
    await _storage.delete(key: _keyUserJson);
    await clearActiveCompany();
  }

  @override
  Future<void> clearAll() => _storage.deleteAll();
}
