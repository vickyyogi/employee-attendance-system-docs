import 'package:flutter/material.dart';

class StatusBadge extends StatelessWidget {
  final String status;

  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    String label = status;

    switch (status.toUpperCase()) {
      case 'PRESENT':
        bg = Colors.green.shade50;
        fg = Colors.green.shade800;
        label = 'Present';
        break;
      case 'LATE':
        bg = Colors.orange.shade50;
        fg = Colors.orange.shade800;
        label = 'Late';
        break;
      case 'IN_PROGRESS':
        bg = Colors.blue.shade50;
        fg = Colors.blue.shade800;
        label = 'In Progress';
        break;
      case 'FLAGGED':
        bg = Colors.red.shade50;
        fg = Colors.red.shade800;
        label = 'Flagged';
        break;
      case 'CORRECTED':
        bg = Colors.purple.shade50;
        fg = Colors.purple.shade800;
        label = 'Corrected';
        break;
      default:
        bg = Colors.grey.shade100;
        fg = Colors.grey.shade800;
        label = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: fg.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
