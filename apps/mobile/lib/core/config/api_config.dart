class ApiConfig {
  static const String defaultBaseUrl = 'http://10.0.2.2:4000/api/v1'; // Android emulator localhost
  static const String localIosBaseUrl = 'http://localhost:4000/api/v1';

  static String baseUrl = defaultBaseUrl;

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);

  static const int maxGpsAccuracyDefaultM = 50;
  static const int maxSelfieSizeBytes = 5 * 1024 * 1024; // 5 MB
}
