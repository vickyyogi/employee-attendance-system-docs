import 'package:flutter/foundation.dart';
import '../../../core/camera/camera_service.dart';
import '../../../core/errors/app_exceptions.dart';
import '../../../core/location/location_service.dart';
import '../../../core/utils/uuid_util.dart';
import '../models/attendance_models.dart';
import '../services/attendance_service.dart';

class AttendanceController extends ChangeNotifier {
  final AttendanceService _attendanceService;
  final ILocationService _locationService;
  final ICameraService _cameraService;

  AttendanceRecordModel? _todayRecord;
  List<WorkLocationModel> _locations = [];
  List<AttendanceRecordModel> _history = [];
  int _historyTotal = 0;
  int _historyPage = 1;

  bool _isLoading = false;
  bool _isSubmitting = false; // Guard for duplicate submission prevention
  String? _errorMessage;
  String? _conflictMessage;
  String? _lastIdempotencyKey;

  AttendanceController({
    required AttendanceService attendanceService,
    required ILocationService locationService,
    required ICameraService cameraService,
  })  : _attendanceService = attendanceService,
        _locationService = locationService,
        _cameraService = cameraService;

  AttendanceRecordModel? get todayRecord => _todayRecord;
  List<WorkLocationModel> get locations => _locations;
  List<AttendanceRecordModel> get history => _history;
  int get historyTotal => _historyTotal;
  int get historyPage => _historyPage;
  bool get isLoading => _isLoading;
  bool get isSubmitting => _isSubmitting;
  String? get errorMessage => _errorMessage;
  String? get conflictMessage => _conflictMessage;
  String? get lastIdempotencyKey => _lastIdempotencyKey;

  bool get canCheckIn => _todayRecord == null || !_todayRecord!.isCheckedIn;
  bool get canCheckOut =>
      _todayRecord != null && _todayRecord!.isCheckedIn && !_todayRecord!.isCheckedOut;

  void clearTenantState() {
    _todayRecord = null;
    _locations = [];
    _history = [];
    _historyTotal = 0;
    _historyPage = 1;
    _errorMessage = null;
    _conflictMessage = null;
    _lastIdempotencyKey = null;
    notifyListeners();
  }

  Future<void> refreshToday() async {
    _isLoading = true;
    _errorMessage = null;
    _conflictMessage = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _attendanceService.getTodayAttendance(),
        _attendanceService.getWorkLocations(),
      ]);

      _todayRecord = results[0] as AttendanceRecordModel?;
      _locations = results[1] as List<WorkLocationModel>;
      _errorMessage = null;
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadHistory({int page = 1}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _attendanceService.getAttendanceHistory(page: page);
      _history = result.records;
      _historyTotal = result.total;
      _historyPage = result.page;
      _errorMessage = null;
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Check-in workflow with GPS, camera selfie, intent upload, and idempotency
  Future<bool> executeCheckIn({
    required WorkLocationModel location,
    SelfiePhoto? selfieOverride,
    String? retryIdempotencyKey,
  }) async {
    // 1. In-flight guard: prevent concurrent or double submission
    if (_isSubmitting) {
      return false;
    }

    _isSubmitting = true;
    _errorMessage = null;
    _conflictMessage = null;
    notifyListeners();

    final idempotencyKey = retryIdempotencyKey ?? UuidUtil.generate();
    _lastIdempotencyKey = idempotencyKey;

    try {
      // 2. Location acquisition & accuracy verification
      final locationData = await _locationService.getCurrentLocation(
        maxAllowedAccuracyM: location.maxGpsAccuracyM,
      );

      // 3. Camera capture & verification
      final photo = selfieOverride ?? await _cameraService.captureSelfie();
      if (!photo.isValidSize) {
        throw const ValidationException(
          message: 'Selfie photo exceeds maximum size limit (5MB)',
        );
      }

      // Validate magic bytes
      final detectedMime = CameraValidationHelper.detectMimeType(photo.bytes);
      if (detectedMime == null) {
        throw const ValidationException(
          message: 'Invalid image format. Allowed formats are JPEG, PNG, and WebP.',
        );
      }

      // 4. Create upload intent
      final intent = await _attendanceService.createSelfieUploadIntent(
        mimeType: detectedMime,
        originalName: photo.fileName,
        fileSizeBytes: photo.fileSizeBytes,
      );

      // 5. Binary upload with retry on network failure
      await _uploadWithRetry(
        uploadUrl: intent.uploadUrl,
        bytes: photo.bytes,
        contentType: detectedMime,
        requiredHeaders: intent.requiredHeaders,
      );

      // 6. Complete selfie upload
      await _attendanceService.completeSelfieUpload(intent.uploadId);

      // 7. Submit check-in
      final record = await _attendanceService.checkIn(
        workLocationId: location.id,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        accuracyM: locationData.accuracyM.round(),
        selfieUploadId: intent.uploadId,
        idempotencyKey: idempotencyKey,
      );

      _todayRecord = record;
      _lastIdempotencyKey = null;
      _errorMessage = null;
      _conflictMessage = null;
      notifyListeners();
      return true;
    } on ConflictException catch (e) {
      _conflictMessage = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    } finally {
      _isSubmitting = false;
      notifyListeners();
    }
  }

  /// Check-out workflow
  Future<bool> executeCheckOut({
    WorkLocationModel? location,
    bool withSelfie = false,
    SelfiePhoto? selfieOverride,
    String? retryIdempotencyKey,
  }) async {
    if (_isSubmitting) {
      return false;
    }

    _isSubmitting = true;
    _errorMessage = null;
    _conflictMessage = null;
    notifyListeners();

    final idempotencyKey = retryIdempotencyKey ?? UuidUtil.generate();
    _lastIdempotencyKey = idempotencyKey;

    try {
      final locationData = await _locationService.getCurrentLocation(
        maxAllowedAccuracyM: location?.maxGpsAccuracyM ?? 50,
      );

      String? selfieUploadId;
      if (withSelfie) {
        final photo = selfieOverride ?? await _cameraService.captureSelfie();
        final detectedMime = CameraValidationHelper.detectMimeType(photo.bytes) ?? 'image/jpeg';
        final intent = await _attendanceService.createSelfieUploadIntent(
          mimeType: detectedMime,
          originalName: photo.fileName,
          fileSizeBytes: photo.fileSizeBytes,
        );

        await _uploadWithRetry(
          uploadUrl: intent.uploadUrl,
          bytes: photo.bytes,
          contentType: detectedMime,
          requiredHeaders: intent.requiredHeaders,
        );

        await _attendanceService.completeSelfieUpload(intent.uploadId);
        selfieUploadId = intent.uploadId;
      }

      final record = await _attendanceService.checkOut(
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        accuracyM: locationData.accuracyM.round(),
        workLocationId: location?.id,
        selfieUploadId: selfieUploadId,
        idempotencyKey: idempotencyKey,
      );

      _todayRecord = record;
      _lastIdempotencyKey = null;
      _errorMessage = null;
      _conflictMessage = null;
      notifyListeners();
      return true;
    } on ConflictException catch (e) {
      _conflictMessage = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    } finally {
      _isSubmitting = false;
      notifyListeners();
    }
  }

  Future<void> _uploadWithRetry({
    required String uploadUrl,
    required List<int> bytes,
    required String contentType,
    Map<String, String>? requiredHeaders,
    int maxRetries = 2,
  }) async {
    int attempts = 0;
    while (attempts <= maxRetries) {
      try {
        await _attendanceService.uploadSelfieBinary(
          uploadUrl: uploadUrl,
          bytes: bytes,
          contentType: contentType,
          extraHeaders: requiredHeaders,
        );
        return;
      } catch (e) {
        attempts++;
        if (attempts > maxRetries) {
          throw NetworkException('Failed to upload selfie after $maxRetries retries: $e');
        }
        await Future.delayed(Duration(milliseconds: 300 * attempts));
      }
    }
  }

  void clearErrors() {
    _errorMessage = null;
    _conflictMessage = null;
    notifyListeners();
  }
}
