import 'package:flutter/foundation.dart';

class ApiConfig {
  /// Android emulator loopback alias to host machine
  static const String androidEmulatorBaseUrl = 'http://10.0.2.2:4000/api/v1';

  /// Standard localhost for Web, Chrome, iOS Simulator, and Windows Desktop
  static const String localhostBaseUrl = 'http://localhost:4000/api/v1';

  /// Resolves the default base URL dynamically based on running platform,
  /// with support for custom URL overrides via `--dart-define=API_BASE_URL=...`
  static String get defaultBaseUrl {
    const customUrl = String.fromEnvironment('API_BASE_URL');
    if (customUrl.isNotEmpty) {
      return customUrl;
    }
    if (kIsWeb) {
      return localhostBaseUrl;
    }
    return defaultTargetPlatform == TargetPlatform.android
        ? androidEmulatorBaseUrl
        : localhostBaseUrl;
  }

  static String baseUrl = defaultBaseUrl;

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);

  static const int maxGpsAccuracyDefaultM = 50;
  static const int maxSelfieSizeBytes = 5 * 1024 * 1024; // 5 MB
}
