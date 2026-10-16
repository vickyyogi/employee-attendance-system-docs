import 'package:flutter/material.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/loading_overlay.dart';
import '../controllers/attendance_controller.dart';
import '../models/attendance_models.dart';

class CheckInScreen extends StatefulWidget {
  final AttendanceController attendanceController;
  final VoidCallback onSuccess;

  const CheckInScreen({
    super.key,
    required this.attendanceController,
    required this.onSuccess,
  });

  @override
  State<CheckInScreen> createState() => _CheckInScreenState();
}

class _CheckInScreenState extends State<CheckInScreen> {
  WorkLocationModel? _selectedLocation;

  @override
  void initState() {
    super.initState();
    final locations = widget.attendanceController.locations;
    if (locations.isNotEmpty) {
      _selectedLocation = locations.first;
    }
  }

  Future<void> _submitCheckIn({bool isRetry = false}) async {
    if (_selectedLocation == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a work location')),
      );
      return;
    }

    final success = await widget.attendanceController.executeCheckIn(
      location: _selectedLocation!,
      retryIdempotencyKey: isRetry ? widget.attendanceController.lastIdempotencyKey : null,
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Check-in submitted successfully!'),
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
        final locations = widget.attendanceController.locations;

        return Scaffold(
          appBar: AppBar(
            title: const Text('Check In', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
          body: LoadingOverlay(
            isLoading: isSubmitting,
            message: 'Verifying GPS location & uploading selfie...',
            child: SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Card(
                      elevation: 0,
                      color: theme.colorScheme.primary.withValues(alpha: 0.08),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(color: theme.colorScheme.primary.withValues(alpha: 0.2)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: theme.colorScheme.primary,
                              child: const Icon(Icons.login, color: Colors.white),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Clock In Verification',
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'GPS geofence coordinates and selfie verification are required.',
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

                    // Conflict Banner
                    if (conflictMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.amber.shade50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.amber.shade300),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.warning_amber_rounded, color: Colors.amber.shade900),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Attendance Conflict',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.amber.shade900,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    conflictMessage,
                                    style: TextStyle(color: Colors.amber.shade900, fontSize: 13),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // General Error Banner
                    if (errorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.error_outline, color: Colors.red.shade700),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Verification Failed',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.red.shade900,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    errorMessage,
                                    style: TextStyle(color: Colors.red.shade800, fontSize: 13),
                                  ),
                                  if (widget.attendanceController.lastIdempotencyKey != null) ...[
                                    const SizedBox(height: 10),
                                    OutlinedButton.icon(
                                      onPressed: isSubmitting ? null : () => _submitCheckIn(isRetry: true),
                                      icon: const Icon(Icons.refresh, size: 16),
                                      label: const Text('Retry Submission'),
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: Colors.red.shade900,
                                        side: BorderSide(color: Colors.red.shade400),
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],

                    Text(
                      'Work Location',
                      style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),

                    if (locations.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Text('No work locations configured for this tenant.'),
                      )
                    else
                      DropdownButtonFormField<WorkLocationModel>(
                        value: _selectedLocation ?? (locations.isNotEmpty ? locations.first : null),
                        items: locations.map((loc) {
                          return DropdownMenuItem(
                            value: loc,
                            child: Text('${loc.name} (Radius: ${loc.geofenceRadiusM}m)'),
                          );
                        }).toList(),
                        onChanged: isSubmitting
                            ? null
                            : (val) {
                                setState(() {
                                  _selectedLocation = val;
                                });
                              },
                        decoration: InputDecoration(
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          prefixIcon: const Icon(Icons.location_on_outlined),
                        ),
                      ),

                    const SizedBox(height: 24),

                    // Information Card
                    Card(
                      elevation: 0,
                      color: Colors.grey.shade50,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(color: Colors.grey.shade200),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(Icons.info_outline, size: 18, color: Colors.grey.shade700),
                                const SizedBox(width: 8),
                                const Text(
                                  'Requirements',
                                  style: TextStyle(fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            _buildRequirementItem(
                              Icons.my_location,
                              'You must be physically within the geofence radius.',
                            ),
                            const SizedBox(height: 6),
                            _buildRequirementItem(
                              Icons.gps_fixed,
                              'GPS signal accuracy must be within maximum threshold (<= 50m).',
                            ),
                            const SizedBox(height: 6),
                            _buildRequirementItem(
                              Icons.camera_alt_outlined,
                              'A live selfie is captured and securely encrypted to server.',
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 32),

                    AppButton(
                      label: 'Capture Selfie & Check In',
                      icon: Icons.camera_alt,
                      isLoading: isSubmitting,
                      onPressed: locations.isEmpty || isSubmitting ? null : () => _submitCheckIn(isRetry: false),
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

  Widget _buildRequirementItem(IconData icon, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: Colors.grey.shade600),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
          ),
        ),
      ],
    );
  }
}
