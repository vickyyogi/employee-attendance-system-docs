import 'package:flutter/material.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/status_badge.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../attendance/controllers/attendance_controller.dart';

class HomeScreen extends StatefulWidget {
  final AuthController authController;
  final AttendanceController attendanceController;
  final VoidCallback onNavigateCheckIn;
  final VoidCallback onNavigateCheckOut;
  final VoidCallback onNavigateHistory;
  final VoidCallback onNavigateSwitchCompany;
  final VoidCallback onLogout;

  const HomeScreen({
    super.key,
    required this.authController,
    required this.attendanceController,
    required this.onNavigateCheckIn,
    required this.onNavigateCheckOut,
    required this.onNavigateHistory,
    required this.onNavigateSwitchCompany,
    required this.onLogout,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.attendanceController.refreshToday();
    });
  }

  String _formatTime(String? isoString) {
    if (isoString == null) return '--:--';
    try {
      final dt = DateTime.parse(isoString).toLocal();
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return isoString;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.authController.activeCompany?.name ?? 'Attendance App',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            Text(
              'Role: ${widget.authController.activeCompany?.role ?? 'Employee'}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.swap_horiz_rounded),
            tooltip: 'Switch Company',
            onPressed: widget.onNavigateSwitchCompany,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign Out',
            onPressed: widget.onLogout,
          ),
        ],
      ),
      body: AnimatedBuilder(
        animation: Listenable.merge([widget.authController, widget.attendanceController]),
        builder: (context, _) {
          final user = widget.authController.user;
          final todayRecord = widget.attendanceController.todayRecord;
          final isLoading = widget.attendanceController.isLoading;

          return RefreshIndicator(
            onRefresh: () => widget.attendanceController.refreshToday(),
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // User Welcome Card
                  Card(
                    elevation: 1,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    child: Padding(
                      padding: const EdgeInsets.all(18.0),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 28,
                            backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.15),
                            child: Text(
                              (user?.fullName.isNotEmpty ?? false)
                                  ? user!.fullName.substring(0, 1).toUpperCase()
                                  : 'U',
                              style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: theme.colorScheme.primary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Hello, ${user?.fullName ?? 'Employee'}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 18,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  user?.email ?? '',
                                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Today's Status Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        "Today's Attendance",
                        style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      if (todayRecord != null) StatusBadge(status: todayRecord.status),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Today's Attendance Main Card
                  Card(
                    elevation: 2,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                    child: Padding(
                      padding: const EdgeInsets.all(20.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (isLoading)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 24.0),
                              child: Center(child: CircularProgressIndicator()),
                            )
                          else if (todayRecord == null) ...[
                            // Not checked in yet
                            Icon(Icons.access_time, size: 48, color: Colors.blue.shade400),
                            const SizedBox(height: 12),
                            const Text(
                              'Not Checked In Yet',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Please clock in when you arrive at your designated work location.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                            ),
                            const SizedBox(height: 20),
                            AppButton(
                              label: 'Clock In Now',
                              icon: Icons.login,
                              onPressed: widget.onNavigateCheckIn,
                            ),
                          ] else if (todayRecord.isInProgress) ...[
                            // In Progress (Checked in, not checked out)
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: Colors.blue.shade50,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(Icons.timer_outlined, color: Colors.blue.shade700),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Currently On Duty',
                                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                      ),
                                      Text(
                                        'Checked in at ${_formatTime(todayRecord.checkInAt)}',
                                        style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            const Divider(),
                            const SizedBox(height: 12),
                            if (todayRecord.workLocationName != null) ...[
                              Row(
                                children: [
                                  Icon(Icons.location_on, size: 16, color: Colors.grey.shade600),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Location: ${todayRecord.workLocationName}',
                                    style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                            ],
                            AppButton(
                              label: 'Clock Out',
                              icon: Icons.logout,
                              color: Colors.orange.shade700,
                              onPressed: widget.onNavigateCheckOut,
                            ),
                          ] else ...[
                            // Finished session
                            Icon(Icons.check_circle_outline, size: 48, color: Colors.green.shade600),
                            const SizedBox(height: 12),
                            const Text(
                              'Attendance Completed',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                            ),
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: Colors.grey.shade50,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceAround,
                                children: [
                                  Column(
                                    children: [
                                      Text('Check In', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                                      const SizedBox(height: 4),
                                      Text(
                                        _formatTime(todayRecord.checkInAt),
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                      ),
                                    ],
                                  ),
                                  Container(height: 30, width: 1, color: Colors.grey.shade300),
                                  Column(
                                    children: [
                                      Text('Check Out', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                                      const SizedBox(height: 4),
                                      Text(
                                        _formatTime(todayRecord.checkOutAt),
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Quick Navigation Cards
                  Text(
                    'Quick Actions',
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),

                  ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    tileColor: Colors.white,
                    leading: CircleAvatar(
                      backgroundColor: Colors.indigo.shade50,
                      child: Icon(Icons.history, color: Colors.indigo.shade700),
                    ),
                    title: const Text('Attendance History', style: TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: const Text('Review your attendance records and timestamps'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: widget.onNavigateHistory,
                  ),

                  const SizedBox(height: 10),

                  ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    tileColor: Colors.white,
                    leading: CircleAvatar(
                      backgroundColor: Colors.teal.shade50,
                      child: Icon(Icons.business_outlined, color: Colors.teal.shade700),
                    ),
                    title: const Text('Switch Tenant Company', style: TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: const Text('Switch between registered company memberships'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: widget.onNavigateSwitchCompany,
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
