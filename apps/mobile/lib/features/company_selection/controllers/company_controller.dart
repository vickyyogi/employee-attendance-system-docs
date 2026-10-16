import 'package:flutter/foundation.dart';
import '../models/company_membership_model.dart';
import '../../auth/controllers/auth_controller.dart';

class CompanyController extends ChangeNotifier {
  final AuthController _authController;

  CompanyController({required AuthController authController})
      : _authController = authController;

  List<CompanyMembershipModel> get memberships => _authController.memberships;
  ActiveCompanyModel? get activeCompany => _authController.activeCompany;
  bool get isLoading => _authController.status == AuthStatus.loading;
  String? get errorMessage => _authController.errorMessage;

  Future<bool> selectCompany(String companyId) async {
    return _authController.selectCompany(companyId);
  }
}
