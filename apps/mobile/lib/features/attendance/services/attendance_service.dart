import '../../../core/network/api_client.dart';
import '../models/attendance_models.dart';

class AttendanceService {
  final ApiClient _apiClient;

  AttendanceService({required ApiClient apiClient}) : _apiClient = apiClient;

  Future<List<WorkLocationModel>> getWorkLocations() async {
    final response = await _apiClient.get('/work-locations');
    final list = response as List<dynamic>? ?? [];
    return list
        .map((loc) => WorkLocationModel.fromJson(loc as Map<String, dynamic>))
        .where((loc) => loc.isActive)
        .toList();
  }

  Future<AttendanceRecordModel?> getTodayAttendance() async {
    final response = await _apiClient.get('/attendance/today');
    if (response == null) return null;
    return AttendanceRecordModel.fromJson(response as Map<String, dynamic>);
  }

  Future<SelfieUploadIntentModel> createSelfieUploadIntent({
    required String mimeType,
    required String originalName,
    required int fileSizeBytes,
  }) async {
    final response = await _apiClient.post(
      '/attendance/selfie-uploads',
      body: {
        'mimeType': mimeType,
        'originalName': originalName,
        'fileSizeBytes': fileSizeBytes,
      },
    );
    return SelfieUploadIntentModel.fromJson(response as Map<String, dynamic>);
  }

  Future<void> uploadSelfieBinary({
    required String uploadUrl,
    required List<int> bytes,
    required String contentType,
    Map<String, String>? extraHeaders,
  }) async {
    await _apiClient.uploadBinary(
      url: uploadUrl,
      bytes: bytes,
      contentType: contentType,
      extraHeaders: extraHeaders,
    );
  }

  Future<void> completeSelfieUpload(String uploadId) async {
    await _apiClient.post('/attendance/selfie-uploads/$uploadId/complete');
  }

  Future<AttendanceRecordModel> checkIn({
    required String workLocationId,
    required double latitude,
    required double longitude,
    required int accuracyM,
    required String selfieUploadId,
    required String idempotencyKey,
  }) async {
    final response = await _apiClient.post(
      '/attendance/check-in',
      body: {
        'workLocationId': workLocationId,
        'latitude': latitude,
        'longitude': longitude,
        'accuracyM': accuracyM,
        'selfieUploadId': selfieUploadId,
        'idempotencyKey': idempotencyKey,
      },
    );
    return AttendanceRecordModel.fromJson(response as Map<String, dynamic>);
  }

  Future<AttendanceRecordModel> checkOut({
    required double latitude,
    required double longitude,
    required int accuracyM,
    String? selfieUploadId,
    String? workLocationId,
    required String idempotencyKey,
  }) async {
    final response = await _apiClient.post(
      '/attendance/check-out',
      body: {
        'latitude': latitude,
        'longitude': longitude,
        'accuracyM': accuracyM,
        if (selfieUploadId != null) 'selfieUploadId': selfieUploadId,
        if (workLocationId != null) 'workLocationId': workLocationId,
        'idempotencyKey': idempotencyKey,
      },
    );
    return AttendanceRecordModel.fromJson(response as Map<String, dynamic>);
  }

  Future<AttendanceHistoryResult> getAttendanceHistory({
    int page = 1,
    int pageSize = 20,
  }) async {
    final response = await _apiClient.get(
      '/attendance/mine',
      queryParams: {
        'page': page.toString(),
        'pageSize': pageSize.toString(),
      },
    );
    return AttendanceHistoryResult.fromJson(response as Map<String, dynamic>);
  }
}
