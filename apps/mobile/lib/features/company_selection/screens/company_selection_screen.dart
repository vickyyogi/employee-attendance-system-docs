import 'package:flutter/material.dart';
import '../controllers/company_controller.dart';
import '../../../core/widgets/loading_overlay.dart';

class CompanySelectionScreen extends StatelessWidget {
  final CompanyController companyController;
  final VoidCallback onCompanySelected;
  final VoidCallback? onLogout;

  const CompanySelectionScreen({
    super.key,
    required this.companyController,
    required this.onCompanySelected,
    this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AnimatedBuilder(
      animation: companyController,
      builder: (context, _) {
        final memberships = companyController.memberships;
        final activeCompany = companyController.activeCompany;
        final isLoading = companyController.isLoading;
        final errorMessage = companyController.errorMessage;

        return Scaffold(
          appBar: AppBar(
            title: const Text('Select Company', style: TextStyle(fontWeight: FontWeight.bold)),
            actions: [
              if (onLogout != null)
                IconButton(
                  icon: const Icon(Icons.logout),
                  tooltip: 'Sign Out',
                  onPressed: isLoading ? null : onLogout,
                ),
            ],
          ),
          body: LoadingOverlay(
            isLoading: isLoading,
            message: 'Switching active company...',
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Choose Company Tenant',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Select the company you want to perform attendance for.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: Colors.grey.shade600,
                      ),
                    ),
                    const SizedBox(height: 16),

                    if (errorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Text(
                          errorMessage,
                          style: TextStyle(color: Colors.red.shade900, fontSize: 13),
                        ),
                      ),
                    ],

                    if (memberships.isEmpty)
                      Expanded(
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.business_outlined, size: 64, color: Colors.grey.shade400),
                              const SizedBox(height: 16),
                              const Text(
                                'No active company memberships found.',
                                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Contact your company HR to invite your account.',
                                style: TextStyle(color: Colors.grey.shade600),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      Expanded(
                        child: ListView.separated(
                          itemCount: memberships.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final m = memberships[index];
                            final isSelected = activeCompany?.id == m.companyId;

                            return Card(
                              elevation: isSelected ? 3 : 1,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                                side: BorderSide(
                                  color: isSelected
                                      ? theme.colorScheme.primary
                                      : Colors.grey.shade200,
                                  width: isSelected ? 2 : 1,
                                ),
                              ),
                              child: ListTile(
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 10,
                                ),
                                leading: CircleAvatar(
                                  backgroundColor: isSelected
                                      ? theme.colorScheme.primary
                                      : Colors.grey.shade100,
                                  child: Icon(
                                    Icons.business,
                                    color: isSelected ? Colors.white : Colors.grey.shade700,
                                  ),
                                ),
                                title: Text(
                                  m.companyName,
                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                ),
                                subtitle: Text(
                                  'Role: ${m.role} • Status: ${m.status}',
                                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                                ),
                                trailing: isSelected
                                    ? Icon(
                                        Icons.check_circle,
                                        color: theme.colorScheme.primary,
                                      )
                                    : const Icon(Icons.chevron_right),
                                onTap: () async {
                                  final success = await companyController.selectCompany(m.companyId);
                                  if (success) {
                                    onCompanySelected();
                                  }
                                },
                              ),
                            );
                          },
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
