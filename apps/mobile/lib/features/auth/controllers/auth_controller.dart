import 'package:flutter/foundation.dart';
import '../../../core/storage/storage_service.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';
import '../../company_selection/models/company_membership_model.dart';

enum AuthStatus {
  uninitialized,
  loading,
  authenticated,
  unauthenticated,
  error,
}

class AuthController extends ChangeNotifier {
  final AuthService _authService;
  final IStorageService _storageService;

  AuthStatus _status = AuthStatus.uninitialized;
  UserModel? _user;
  List<CompanyMembershipModel> _memberships = [];
  ActiveCompanyModel? _activeCompany;
  String? _errorMessage;

  AuthController({
    required AuthService authService,
    required IStorageService storageService,
  })  : _authService = authService,
        _storageService = storageService;

  AuthStatus get status => _status;
  UserModel? get user => _user;
  List<CompanyMembershipModel> get memberships => _memberships;
  ActiveCompanyModel? get activeCompany => _activeCompany;
  String? get errorMessage => _errorMessage;

  bool get isAuthenticated => _status == AuthStatus.authenticated && _user != null;
  bool get hasActiveCompany => _activeCompany != null;

  Future<void> initialize() async {
    _status = AuthStatus.loading;
    notifyListeners();

    try {
      final token = await _storageService.getAccessToken();
      if (token == null || token.isEmpty) {
        _status = AuthStatus.unauthenticated;
        notifyListeners();
        return;
      }

      final data = await _authService.getMe();
      _user = data.user;
      _memberships = data.memberships;
      _activeCompany = data.activeCompany;
      _status = AuthStatus.authenticated;
      _errorMessage = null;
    } catch (e) {
      await _storageService.clearAuth();
      _user = null;
      _memberships = [];
      _activeCompany = null;
      _status = AuthStatus.unauthenticated;
    } finally {
      notifyListeners();
    }
  }

  Future<bool> login(String email, String password) async {
    _status = AuthStatus.loading;
    _errorMessage = null;
    notifyListeners();

    try {
      await _authService.login(email, password);
      final meData = await _authService.getMe();

      _user = meData.user;
      _memberships = meData.memberships;
      _activeCompany = meData.activeCompany;
      _status = AuthStatus.authenticated;
      _errorMessage = null;
      notifyListeners();
      return true;
    } catch (e) {
      _status = AuthStatus.error;
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> selectCompany(String companyId) async {
    _status = AuthStatus.loading;
    _errorMessage = null;
    notifyListeners();

    try {
      final active = await _authService.selectActiveCompany(companyId);
      _activeCompany = active;
      _status = AuthStatus.authenticated;
      _errorMessage = null;
      notifyListeners();
      return true;
    } catch (e) {
      _status = AuthStatus.error;
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _status = AuthStatus.loading;
    notifyListeners();

    await _authService.logout();
    _user = null;
    _memberships = [];
    _activeCompany = null;
    _errorMessage = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
