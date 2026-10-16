class WorkLocationModel {
  final String id;
  final String name;
  final String? address;
  final double latitude;
  final double longitude;
  final int geofenceRadiusM;
  final int maxGpsAccuracyM;
  final bool isActive;

  const WorkLocationModel({
    required this.id,
    required this.name,
    this.address,
    required this.latitude,
    required this.longitude,
    required this.geofenceRadiusM,
    required this.maxGpsAccuracyM,
    required this.isActive,
  });

  factory WorkLocationModel.fromJson(Map<String, dynamic> json) {
    return WorkLocationModel(
      id: json['id'] as String,
      name: json['name'] as String,
      address: json['address'] as String?,
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      geofenceRadiusM: json['geofenceRadiusM'] as int? ?? 100,
      maxGpsAccuracyM: json['maxGpsAccuracyM'] as int? ?? 50,
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'address': address,
        'latitude': latitude,
        'longitude': longitude,
        'geofenceRadiusM': geofenceRadiusM,
        'maxGpsAccuracyM': maxGpsAccuracyM,
        'isActive': isActive,
      };
}

class ShiftInfoModel {
  final String id;
  final String name;
  final String startTimeLocal;
  final String endTimeLocal;

  const ShiftInfoModel({
    required this.id,
    required this.name,
    required this.startTimeLocal,
    required this.endTimeLocal,
  });

  factory ShiftInfoModel.fromJson(Map<String, dynamic> json) {
    return ShiftInfoModel(
      id: json['id'] as String,
      name: json['name'] as String,
      startTimeLocal: json['startTimeLocal'] as String,
      endTimeLocal: json['endTimeLocal'] as String,
    );
  }
}

class SelfieUploadIntentModel {
  final String uploadId;
  final String uploadUrl;
  final String objectKey;
  final int expiresInSeconds;
  final int maxFileSizeBytes;
  final Map<String, String>? requiredHeaders;

  const SelfieUploadIntentModel({
    required this.uploadId,
    required this.uploadUrl,
    required this.objectKey,
    required this.expiresInSeconds,
    required this.maxFileSizeBytes,
    this.requiredHeaders,
  });

  factory SelfieUploadIntentModel.fromJson(Map<String, dynamic> json) {
    Map<String, String>? headers;
    if (json['requiredHeaders'] != null) {
      headers = (json['requiredHeaders'] as Map<String, dynamic>)
          .map((k, v) => MapEntry(k, v.toString()));
    }
    return SelfieUploadIntentModel(
      uploadId: json['uploadId'] as String,
      uploadUrl: json['uploadUrl'] as String,
      objectKey: json['objectKey'] as String,
      expiresInSeconds: json['expiresInSeconds'] as int? ?? 900,
      maxFileSizeBytes: json['maxFileSizeBytes'] as int? ?? 5242880,
      requiredHeaders: headers,
    );
  }
}

class AttendanceRecordModel {
  final String id;
  final String companyId;
  final String employeeId;
  final String workDate;
  final String? shiftId;
  final ShiftInfoModel? shift;
  final String? workLocationId;
  final String? workLocationName;
  final String? checkInAt;
  final String? checkOutAt;
  final double? checkInLatitude;
  final double? checkInLongitude;
  final int? checkInAccuracyM;
  final int? checkInDistanceM;
  final bool? checkInGeofenceValid;
  final double? checkOutLatitude;
  final double? checkOutLongitude;
  final int? checkOutAccuracyM;
  final int? checkOutDistanceM;
  final bool? checkOutGeofenceValid;
  final String status;
  final String? idempotencyKey;
  final String? flagReason;
  final String createdAt;
  final String updatedAt;

  const AttendanceRecordModel({
    required this.id,
    required this.companyId,
    required this.employeeId,
    required this.workDate,
    this.shiftId,
    this.shift,
    this.workLocationId,
    this.workLocationName,
    this.checkInAt,
    this.checkOutAt,
    this.checkInLatitude,
    this.checkInLongitude,
    this.checkInAccuracyM,
    this.checkInDistanceM,
    this.checkInGeofenceValid,
    this.checkOutLatitude,
    this.checkOutLongitude,
    this.checkOutAccuracyM,
    this.checkOutDistanceM,
    this.checkOutGeofenceValid,
    required this.status,
    this.idempotencyKey,
    this.flagReason,
    required this.createdAt,
    required this.updatedAt,
  });

  factory AttendanceRecordModel.fromJson(Map<String, dynamic> json) {
    ShiftInfoModel? shift;
    if (json['shift'] != null) {
      shift = ShiftInfoModel.fromJson(json['shift'] as Map<String, dynamic>);
    }

    String? locationName;
    if (json['workLocation'] != null && json['workLocation'] is Map) {
      locationName = json['workLocation']['name'] as String?;
    }

    double? parseDouble(dynamic v) {
      if (v == null) return null;
      if (v is num) return v.toDouble();
      return double.tryParse(v.toString());
    }

    return AttendanceRecordModel(
      id: json['id'] as String,
      companyId: json['companyId'] as String,
      employeeId: json['employeeId'] as String,
      workDate: json['workDate'] as String,
      shiftId: json['shiftId'] as String?,
      shift: shift,
      workLocationId: json['workLocationId'] as String?,
      workLocationName: locationName,
      checkInAt: json['checkInAt'] as String?,
      checkOutAt: json['checkOutAt'] as String?,
      checkInLatitude: parseDouble(json['checkInLatitude']),
      checkInLongitude: parseDouble(json['checkInLongitude']),
      checkInAccuracyM: json['checkInAccuracyM'] as int?,
      checkInDistanceM: json['checkInDistanceM'] as int?,
      checkInGeofenceValid: json['checkInGeofenceValid'] as bool?,
      checkOutLatitude: parseDouble(json['checkOutLatitude']),
      checkOutLongitude: parseDouble(json['checkOutLongitude']),
      checkOutAccuracyM: json['checkOutAccuracyM'] as int?,
      checkOutDistanceM: json['checkOutDistanceM'] as int?,
      checkOutGeofenceValid: json['checkOutGeofenceValid'] as bool?,
      status: json['status'] as String? ?? 'IN_PROGRESS',
      idempotencyKey: json['idempotencyKey'] as String?,
      flagReason: json['flagReason'] as String?,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }

  bool get isCheckedIn => checkInAt != null;
  bool get isCheckedOut => checkOutAt != null;
  bool get isInProgress => status == 'IN_PROGRESS';
}

class AttendanceHistoryResult {
  final List<AttendanceRecordModel> records;
  final int total;
  final int page;
  final int pageSize;

  const AttendanceHistoryResult({
    required this.records,
    required this.total,
    required this.page,
    required this.pageSize,
  });

  factory AttendanceHistoryResult.fromJson(Map<String, dynamic> json) {
    final list = (json['records'] as List<dynamic>? ?? [])
        .map((r) => AttendanceRecordModel.fromJson(r as Map<String, dynamic>))
        .toList();

    return AttendanceHistoryResult(
      records: list,
      total: json['total'] as int? ?? list.length,
      page: json['page'] as int? ?? 1,
      pageSize: json['pageSize'] as int? ?? 20,
    );
  }
}
