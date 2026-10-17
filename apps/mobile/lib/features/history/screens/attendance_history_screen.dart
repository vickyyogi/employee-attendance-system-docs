import 'package:flutter/material.dart';
import '../../attendance/controllers/attendance_controller.dart';
import '../../attendance/models/attendance_models.dart';

class AttendanceHistoryScreen extends StatefulWidget {
  final AttendanceController attendanceController;

  const AttendanceHistoryScreen({
    super.key,
    required this.attendanceController,
  });

  @override
  State<AttendanceHistoryScreen> createState() => _AttendanceHistoryScreenState();
}

class _AttendanceHistoryScreenState extends State<AttendanceHistoryScreen> {
  late DateTime _selectedDate;
  late final ScrollController _dateScrollController;
  bool _filterBySelectedDate = false;

  @override
  void initState() {
    super.initState();
    _selectedDate = DateTime.now();
    _dateScrollController = ScrollController();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.attendanceController.loadHistory();
      _scrollToToday();
    });
  }

  @override
  void dispose() {
    _dateScrollController.dispose();
    super.dispose();
  }

  void _scrollToToday() {
    if (_dateScrollController.hasClients) {
      // Approximate offset to center today in the 15-day window
      _dateScrollController.animateTo(
        7 * 64.0 - 120.0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  String _formatMonthYear(DateTime dt) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return '${months[dt.month - 1]} ${dt.year}';
  }

  String _getWeekdayName(DateTime dt) {
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return weekdays[dt.weekday - 1];
  }

  String _formatTimelineTime(String? isoString, {bool isStart = true}) {
    if (isoString == null) return isStart ? '09 am' : '05 pm';
    try {
      final dt = DateTime.parse(isoString).toLocal();
      final hour = dt.hour;
      final minute = dt.minute;
      final period = hour >= 12 ? 'pm' : 'am';
      final h12 = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
      if (minute == 0) {
        return '${h12.toString().padLeft(2, '0')} $period';
      }
      return '${h12.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')} $period';
    } catch (_) {
      return '--:--';
    }
  }

  String _calculateDuration(String? checkIn, String? checkOut) {
    if (checkIn == null) return '0 hrs';
    try {
      final inTime = DateTime.parse(checkIn).toLocal();
      final outTime = checkOut != null ? DateTime.parse(checkOut).toLocal() : DateTime.now();
      final diff = outTime.difference(inTime);
      final hours = diff.inHours;
      final minutes = diff.inMinutes.remainder(60);
      if (hours == 0) return '${minutes}m on-duty';
      return '${hours}h ${minutes}m';
    } catch (_) {
      return 'Standard shift';
    }
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  List<DateTime> _generateDateRange() {
    final now = _selectedDate;
    return List.generate(15, (index) {
      return now.subtract(Duration(days: 7 - index));
    });
  }

  @override
  Widget build(BuildContext context) {
    const darkNavy = Color(0xFF131927);

    return Scaffold(
      backgroundColor: darkNavy,
      appBar: AppBar(
        backgroundColor: darkNavy,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text(
          'My Tasks',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 18,
            letterSpacing: -0.2,
          ),
        ),
        centerTitle: true,
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: Colors.white),
            color: const Color(0xFF1E2638),
            onSelected: (val) {
              if (val == 'refresh') {
                widget.attendanceController.loadHistory();
              } else if (val == 'toggle_filter') {
                setState(() {
                  _filterBySelectedDate = !_filterBySelectedDate;
                });
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'toggle_filter',
                child: Text(
                  _filterBySelectedDate ? 'Show All History' : 'Filter by Selected Day',
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                ),
              ),
              const PopupMenuItem(
                value: 'refresh',
                child: Text(
                  'Refresh History',
                  style: TextStyle(color: Colors.white, fontSize: 13),
                ),
              ),
            ],
          ),
        ],
      ),
      body: AnimatedBuilder(
        animation: widget.attendanceController,
        builder: (context, _) {
          final isLoading = widget.attendanceController.isLoading;
          final errorMessage = widget.attendanceController.errorMessage;
          final allHistory = widget.attendanceController.history;

          // Filter history according to selected date or all
          final selectedIsoDate =
              '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';

          final displayedRecords = _filterBySelectedDate
              ? allHistory.where((r) => r.workDate.startsWith(selectedIsoDate)).toList()
              : allHistory;

          return RefreshIndicator(
            onRefresh: () => widget.attendanceController.loadHistory(),
            color: const Color(0xFFB8F635),
            backgroundColor: const Color(0xFF1E2638),
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 8),

                  // Month & Year Selector Header (matching reference: January 2023 ∨)
                  GestureDetector(
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _selectedDate,
                        firstDate: DateTime(2020),
                        lastDate: DateTime(2030),
                        builder: (context, child) {
                          return Theme(
                            data: ThemeData.dark().copyWith(
                              colorScheme: const ColorScheme.dark(
                                primary: Color(0xFFB8F635),
                                onPrimary: Color(0xFF0F172A),
                                surface: Color(0xFF1E2638),
                                onSurface: Colors.white,
                              ),
                            ),
                            child: child!,
                          );
                        },
                      );
                      if (picked != null) {
                        setState(() {
                          _selectedDate = picked;
                          _filterBySelectedDate = true;
                        });
                      }
                    },
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _formatMonthYear(_selectedDate),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Icon(
                          Icons.keyboard_arrow_down_rounded,
                          color: Colors.white,
                          size: 24,
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Horizontal Date Strip (matching reference day capsules)
                  SizedBox(
                    height: 88,
                    child: ListView.builder(
                      controller: _dateScrollController,
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _generateDateRange().length,
                      itemBuilder: (context, index) {
                        final dt = _generateDateRange()[index];
                        final isSelected = _isSameDay(dt, _selectedDate);

                        return GestureDetector(
                          onTap: () {
                            setState(() {
                              _selectedDate = dt;
                              _filterBySelectedDate = true;
                            });
                          },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            margin: const EdgeInsets.symmetric(horizontal: 5),
                            width: isSelected ? 58 : 52,
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? const Color(0xFFD9F99D) // Soft lime active pill
                                  : const Color(0xFF1A2132), // Dark slate capsule
                              borderRadius: BorderRadius.circular(28),
                              boxShadow: isSelected
                                  ? [
                                      BoxBoxShadow(
                                        color: const Color(0xFFD9F99D).withValues(alpha: 0.35),
                                        blurRadius: 12,
                                        offset: const Offset(0, 4),
                                      ),
                                    ]
                                  : null,
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  dt.day.toString(),
                                  style: TextStyle(
                                    fontSize: isSelected ? 20 : 17,
                                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.bold,
                                    color: isSelected ? const Color(0xFF0F172A) : Colors.white,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _getWeekdayName(dt),
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                    color: isSelected
                                        ? const Color(0xFF0F172A)
                                        : const Color(0xFF8E95A5),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Mode indicator & reset pill
                  if (_filterBySelectedDate)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Showing: ${_selectedDate.day} ${_getWeekdayName(_selectedDate)}',
                            style: const TextStyle(
                              color: Color(0xFF8E95A5),
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          GestureDetector(
                            onTap: () {
                              setState(() {
                                _filterBySelectedDate = false;
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFF1E2638),
                                borderRadius: BorderRadius.circular(9999),
                              ),
                              child: const Text(
                                'View All Dates',
                                style: TextStyle(
                                  color: Color(0xFFB8F635),
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                  const SizedBox(height: 12),

                  // Loading State
                  if (isLoading && allHistory.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40.0),
                      child: Center(
                        child: CircularProgressIndicator(color: Color(0xFFB8F635)),
                      ),
                    )

                  // Error State
                  else if (errorMessage != null && allHistory.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Center(
                        child: Column(
                          children: [
                            const Icon(Icons.error_outline, size: 48, color: Color(0xFFF87171)),
                            const SizedBox(height: 12),
                            const Text(
                              'Failed to load history',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              errorMessage,
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Color(0xFF8E95A5), fontSize: 13),
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFB8F635),
                                foregroundColor: const Color(0xFF0F172A),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                              ),
                              onPressed: () => widget.attendanceController.loadHistory(),
                              child: const Text('Try Again', style: TextStyle(fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                      ),
                    )

                  // Empty State for specific selected date or all
                  else if (displayedRecords.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 48.0, horizontal: 24.0),
                      child: Center(
                        child: Column(
                          children: [
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                color: const Color(0xFF1A2132),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Icon(
                                Icons.calendar_today_outlined,
                                color: Color(0xFF8E95A5),
                                size: 30,
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              _filterBySelectedDate
                                  ? 'No records on ${_selectedDate.day} ${_getWeekdayName(_selectedDate)}'
                                  : 'No attendance records found',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              _filterBySelectedDate
                                  ? 'Tap "View All Dates" above to browse other days.'
                                  : 'Your attendance records will appear along this timeline.',
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Color(0xFF8E95A5), fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    )

                  // Timeline & Contoured Cards List (Matching reference exactly!)
                  else
                    ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      itemCount: displayedRecords.length,
                      itemBuilder: (context, index) {
                        final record = displayedRecords[index];
                        return _buildTimelineItem(record, index);
                      },
                    ),

                  const SizedBox(height: 40),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildTimelineItem(AttendanceRecordModel record, int index) {
    // Style configuration matching the 4 color cards in the reference image:
    // Card 1: Lime (Completed / Present)
    // Card 2: Sky Blue (Rejected / Flagged / Late)
    // Card 3: Lavender (Running / In Progress)
    // Card 4: Soft Yellow (Upcoming / Scheduled)
    late Color cardBg;
    late Color textColor;
    late String statusTab;
    late String progressPercent;
    late double progressValue;
    late IconData iconData;

    switch (record.status) {
      case 'PRESENT':
      case 'CORRECTED':
        cardBg = const Color(0xFFD9F99D); // Soft lime
        textColor = const Color(0xFF142010);
        statusTab = 'Completed';
        progressPercent = '100%';
        progressValue = 1.0;
        iconData = Icons.done_all_rounded;
        break;
      case 'LATE':
      case 'FLAGGED':
        cardBg = const Color(0xFF38BDF8); // Sky blue
        textColor = const Color(0xFF082F49);
        statusTab = record.status == 'FLAGGED' ? 'Rejected' : 'Late Arrival';
        progressPercent = record.status == 'FLAGGED' ? '00%' : '50%';
        progressValue = record.status == 'FLAGGED' ? 0.0 : 0.5;
        iconData = Icons.warning_amber_rounded;
        break;
      case 'IN_PROGRESS':
        cardBg = const Color(0xFFE9D5FF); // Pastel lavender
        textColor = const Color(0xFF3B0764);
        statusTab = 'Running';
        progressPercent = '72%';
        progressValue = 0.72;
        iconData = Icons.timer_outlined;
        break;
      default:
        cardBg = const Color(0xFFFEF08A); // Soft yellow
        textColor = const Color(0xFF422006);
        statusTab = 'Upcoming';
        progressPercent = '00%';
        progressValue = 0.0;
        iconData = Icons.schedule_rounded;
        break;
    }

    final startTime = _formatTimelineTime(record.checkInAt, isStart: true);
    final endTime = _formatTimelineTime(record.checkOutAt, isStart: false);
    final duration = _calculateDuration(record.checkInAt, record.checkOutAt);

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Left Timeline Column: Start time, dashed line, End time
          SizedBox(
            width: 58,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  startTime,
                  style: const TextStyle(
                    color: Color(0xFF8E95A5),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  margin: const EdgeInsets.only(left: 14),
                  height: 68,
                  width: 2,
                  child: CustomPaint(
                    painter: _DashedLinePainter(
                      color: const Color(0xFF283248),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  endTime,
                  style: const TextStyle(
                    color: Color(0xFF8E95A5),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(width: 8),

          // Right Column: The Contoured Colored Card (Matching reference card)
          Expanded(
            child: GestureDetector(
              onTap: () => _showRecordDetailsModal(record),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  // Main Contoured Card Body with Notched Tab Shape
                  ClipPath(
                    clipper: _ContouredCardClipper(
                      tabWidth: 104,
                      tabHeight: 28,
                      radius: 20,
                    ),
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(16, 38, 16, 18),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.25),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          // Dark rounded-square icon badge on left
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: const Color(0xFF131927),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Icon(
                              iconData,
                              color: Colors.white,
                              size: 20,
                            ),
                          ),

                          const SizedBox(width: 12),

                          // Title and Subtitle
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  record.shift?.name ?? 'Standard Shift',
                                  style: TextStyle(
                                    color: textColor,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.2,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  '${record.workLocationName ?? 'HQ Office'} • $duration',
                                  style: TextStyle(
                                    color: textColor.withValues(alpha: 0.75),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),

                          // 3-dots action icon
                          IconButton(
                            icon: Icon(Icons.more_vert, color: textColor),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            onPressed: () => _showRecordDetailsModal(record),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Top-Left Notched Tab Status Label
                  Positioned(
                    top: 6,
                    left: 14,
                    child: Text(
                      statusTab,
                      style: TextStyle(
                        color: textColor,
                        fontWeight: FontWeight.w800,
                        fontSize: 11,
                        letterSpacing: -0.1,
                      ),
                    ),
                  ),

                  // Top-Right Overlapping Avatars Cluster + Mini Progress Track
                  Positioned(
                    top: -10,
                    right: 14,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Stacked circular avatars with + badge
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _buildAvatarCircle('A', const Color(0xFFF97316), 0),
                            _buildAvatarCircle('V', const Color(0xFF06B6D4), -8),
                            _buildAvatarCircle('+', const Color(0xFF1E2638), -8, isPlus: true),
                          ],
                        ),

                        const SizedBox(width: 12),

                        // Mini progress bar
                        Container(
                          width: 42,
                          height: 4,
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E2638),
                            borderRadius: BorderRadius.circular(9999),
                          ),
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: Container(
                              width: 42 * progressValue,
                              height: 4,
                              decoration: BoxDecoration(
                                color: const Color(0xFFB8F635),
                                borderRadius: BorderRadius.circular(9999),
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(width: 6),

                        // Percentage text
                        Text(
                          progressPercent,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarCircle(String label, Color bg, double leftMargin, {bool isPlus = false}) {
    return Container(
      margin: EdgeInsets.only(left: leftMargin),
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFF131927), width: 1.5),
      ),
      child: Center(
        child: Text(
          label,
          style: TextStyle(
            color: Colors.white,
            fontSize: isPlus ? 11 : 9,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  void _showRecordDetailsModal(AttendanceRecordModel record) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1A2132),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFF334155),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        record.shift?.name ?? 'Standard Shift',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        record.workDate,
                        style: const TextStyle(color: Color(0xFF8E95A5), fontSize: 13),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFD9F99D),
                      borderRadius: BorderRadius.circular(9999),
                    ),
                    child: Text(
                      record.status,
                      style: const TextStyle(
                        color: Color(0xFF0F172A),
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
              const Divider(color: Color(0xFF283248), height: 28),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  Column(
                    children: [
                      const Text('Check In', style: TextStyle(color: Color(0xFF8E95A5), fontSize: 12)),
                      const SizedBox(height: 4),
                      Text(
                        _formatTimelineTime(record.checkInAt, isStart: true),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                    ],
                  ),
                  Container(width: 1, height: 28, color: const Color(0xFF283248)),
                  Column(
                    children: [
                      const Text('Check Out', style: TextStyle(color: Color(0xFF8E95A5), fontSize: 12)),
                      const SizedBox(height: 4),
                      Text(
                        _formatTimelineTime(record.checkOutAt, isStart: false),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (record.workLocationName != null)
                Row(
                  children: [
                    const Icon(Icons.location_on, size: 16, color: Color(0xFFB8F635)),
                    const SizedBox(width: 6),
                    Text(
                      'Location: ${record.workLocationName}',
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                    ),
                    if (record.checkInDistanceM != null)
                      Text(
                        ' • ${record.checkInDistanceM}m geofence',
                        style: const TextStyle(color: Color(0xFF8E95A5), fontSize: 12),
                      ),
                  ],
                ),
              if (record.flagReason != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    'Flag Reason: ${record.flagReason}',
                    style: const TextStyle(color: Color(0xFFF87171), fontSize: 12),
                  ),
                ),
              ],
              const SizedBox(height: 20),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFB8F635),
                  foregroundColor: const Color(0xFF0F172A),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9999)),
                ),
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Close', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      },
    );
  }
}

// Custom painter for the vertical dashed timeline line
class _DashedLinePainter extends CustomPainter {
  final Color color;
  final double dashHeight;
  final double dashSpace;

  _DashedLinePainter({
    required this.color,
    this.dashHeight = 3.5,
    this.dashSpace = 3.5,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.8;

    double startY = 0;
    while (startY < size.height) {
      canvas.drawLine(
        Offset(size.width / 2, startY),
        Offset(size.width / 2, startY + dashHeight),
        paint,
      );
      startY += dashHeight + dashSpace;
    }
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) => false;
}

// Custom clipper for the contoured card with top-left notch
class _ContouredCardClipper extends CustomClipper<Path> {
  final double tabWidth;
  final double tabHeight;
  final double radius;

  _ContouredCardClipper({
    required this.tabWidth,
    required this.tabHeight,
    required this.radius,
  });

  @override
  Path getClip(Size size) {
    final path = Path();
    // Start at left, below top-left corner
    path.moveTo(0, radius);
    path.quadraticBezierTo(0, 0, radius, 0);

    // Across the tab to the right edge of notch
    path.lineTo(tabWidth - radius, 0);
    path.quadraticBezierTo(tabWidth, 0, tabWidth + 4, 6);

    // Curve down into the lower step
    path.quadraticBezierTo(tabWidth + 12, tabHeight, tabWidth + 22, tabHeight);

    // Across the lower step
    path.lineTo(size.width - radius, tabHeight);
    path.quadraticBezierTo(size.width, tabHeight, size.width, tabHeight + radius);

    // Down right edge
    path.lineTo(size.width, size.height - radius);
    path.quadraticBezierTo(size.width, size.height, size.width - radius, size.height);

    // Across bottom edge
    path.lineTo(radius, size.height);
    path.quadraticBezierTo(0, size.height, 0, size.height - radius);

    // Close path
    path.close();
    return path;
  }

  @override
  bool shouldReclip(CustomClipper<Path> oldClipper) => false;
}
