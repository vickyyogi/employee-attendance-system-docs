import 'package:flutter/material.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/loading_overlay.dart';
import '../controllers/attendance_controller.dart';

class CheckOutScreen extends StatefulWidget {
  final AttendanceController attendanceController;
  final VoidCallback onSuccess;

  const CheckOutScreen({
    super.key,
    required this.attendanceController,
    required this.onSuccess,
  });

  @override
  State<CheckOutScreen> createState() => _CheckOutScreenState();
}

class _CheckOutScreenState extends State<CheckOutScreen> {
  bool _includeSelfie = false;

  Future<void> _submitCheckOut({bool isRetry = false}) async {
    final success = await widget.attendanceController.executeCheckOut(
      withSelfie: _includeSelfie,
      retryIdempotencyKey: isRetry ? widget.attendanceController.lastIdempotencyKey : null,
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Check-out completed successfully!'),
          backgroundColor: Colors.green,
        ),
      );
      widget.onSuccess();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AnimatedBuilder(
      animation: widget.attendanceController,
      builder: (context, _) {
        final isSubmitting = widget.attendanceController.isSubmitting;
        final errorMessage = widget.attendanceController.errorMessage;
        final conflictMessage = widget.attendanceController.conflictMessage;
        final todayRecord = widget.attendanceController.todayRecord;

        return Scaffold(
          appBar: AppBar(
            title: const Text('Check Out', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
          body: LoadingOverlay(
            isLoading: isSubmitting,
            message: 'Verifying GPS location & recording check-out...',
            child: SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Card(
                      elevation: 0,
                      color: Colors.orange.shade50,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(color: Colors.orange.shade200),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: Colors.orange.shade600,
                              child: const Icon(Icons.logout, color: Colors.white),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Clock Out Session',
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'End your active work session with authoritative server timestamp.',
                                    style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Active session info
                    if (todayRecord != null) ...[
                      Card(
                        elevation: 1,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Active Session Info',
                                style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                              ),
                              const Divider(height: 20),
                              _buildInfoRow('Work Date:', todayRecord.workDate),
                              const SizedBox(height: 8),
                              _buildInfoRow(
                                'Check-in Time:',
                                todayRecord.checkInAt != null
                                    ? DateTime.parse(todayRecord.checkInAt!).toLocal().toString().substring(11, 19)
                                    : '-',
                              ),
                              if (todayRecord.workLocationName != null) ...[
                                const SizedBox(height: 8),
                                _buildInfoRow('Location:', todayRecord.workLocationName!),
                              ],
                              const SizedBox(height: 8),
                              _buildInfoRow('Current Status:', todayRecord.status),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],

                    // Conflict Banner
                    if (conflictMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.amber.shade50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.amber.shade300),
                        ),
                        child: Text(
                          conflictMessage,
                          style: TextStyle(color: Colors.amber.shade900, fontSize: 13),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Error Banner
                    if (errorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              errorMessage,
                              style: TextStyle(color: Colors.red.shade800, fontSize: 13),
                            ),
                            if (widget.attendanceController.lastIdempotencyKey != null) ...[
                              const SizedBox(height: 10),
                              OutlinedButton.icon(
                                onPressed: isSubmitting ? null : () => _submitCheckOut(isRetry: true),
                                icon: const Icon(Icons.refresh, size: 16),
                                label: const Text('Retry Submission'),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],

                    // Optional selfie toggle
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Attach Checkout Selfie'),
                      subtitle: const Text('Optional selfie verification upon checkout'),
                      value: _includeSelfie,
                      onChanged: isSubmitting
                          ? null
                          : (val) {
                              setState(() {
                                _includeSelfie = val;
                              });
                            },
                    ),

                    const SizedBox(height: 32),

                    AppButton(
                      label: 'Confirm Check Out',
                      icon: Icons.logout,
                      color: Colors.orange.shade700,
                      isLoading: isSubmitting,
                      onPressed: isSubmitting ? null : () => _submitCheckOut(isRetry: false),
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

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
      ],
    );
  }
}
