import 'dart:typed_data';
import '../config/api_config.dart';

class SelfiePhoto {
  final Uint8List bytes;
  final String mimeType;
  final String fileName;
  final int fileSizeBytes;

  const SelfiePhoto({
    required this.bytes,
    required this.mimeType,
    required this.fileName,
    required this.fileSizeBytes,
  });

  bool get isValidSize => fileSizeBytes > 0 && fileSizeBytes <= ApiConfig.maxSelfieSizeBytes;
}

abstract class ICameraService {
  Future<bool> hasPermission();
  Future<bool> requestPermission();
  Future<SelfiePhoto> captureSelfie();
}

class CameraValidationHelper {
  /// Verifies image binary signatures (JPEG: FF D8 FF, PNG: 89 50 4E 47, WebP: RIFF...WEBP)
  static String? detectMimeType(List<int> bytes) {
    if (bytes.length < 12) return null;

    // JPEG
    if (bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) {
      return 'image/jpeg';
    }

    // PNG
    if (bytes[0] == 0x89 &&
        bytes[1] == 0x50 &&
        bytes[2] == 0x4E &&
        bytes[3] == 0x47 &&
        bytes[4] == 0x0D &&
        bytes[5] == 0x0A &&
        bytes[6] == 0x1A &&
        bytes[7] == 0x0A) {
      return 'image/png';
    }

    // WebP: starts with "RIFF" and has "WEBP" at bytes 8-11
    if (bytes[0] == 0x52 &&
        bytes[1] == 0x49 &&
        bytes[2] == 0x46 &&
        bytes[3] == 0x46 &&
        bytes[8] == 0x57 &&
        bytes[9] == 0x45 &&
        bytes[10] == 0x42 &&
        bytes[11] == 0x50) {
      return 'image/webp';
    }

    return null;
  }
}
