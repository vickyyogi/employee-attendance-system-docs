import 'package:geolocator/geolocator.dart';
import '../errors/app_exceptions.dart';

class LocationData {
  final double latitude;
  final double longitude;
  final double accuracyM;

  const LocationData({
    required this.latitude,
    required this.longitude,
    required this.accuracyM,
  });

  @override
  String toString() => 'LocationData(lat: $latitude, lon: $longitude, accuracy: ${accuracyM}m)';
}

abstract class ILocationService {
  Future<bool> isServiceEnabled();
  Future<LocationPermission> checkPermission();
  Future<LocationPermission> requestPermission();
  Future<LocationData> getCurrentLocation({int maxAllowedAccuracyM = 50});
}

class LocationService implements ILocationService {
  @override
  Future<bool> isServiceEnabled() => Geolocator.isLocationServiceEnabled();

  @override
  Future<LocationPermission> checkPermission() => Geolocator.checkPermission();

  @override
  Future<LocationPermission> requestPermission() => Geolocator.requestPermission();

  @override
  Future<LocationData> getCurrentLocation({int maxAllowedAccuracyM = 50}) async {
    final serviceEnabled = await isServiceEnabled();
    if (!serviceEnabled) {
      throw const LocationAppException(
        'Location services are disabled on this device. Please enable GPS in settings.',
        type: LocationErrorType.serviceDisabled,
      );
    }

    LocationPermission permission = await checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await requestPermission();
      if (permission == LocationPermission.denied) {
        throw const LocationAppException(
          'Location permission was denied. Location is required for attendance verification.',
          type: LocationErrorType.permissionDenied,
        );
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw const LocationAppException(
        'Location permissions are permanently denied. Please enable them in app settings.',
        type: LocationErrorType.permissionDeniedForever,
      );
    }

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );

      if (position.accuracy > maxAllowedAccuracyM) {
        throw LocationAppException(
          'GPS accuracy (${position.accuracy.toStringAsFixed(1)}m) exceeds allowable threshold (${maxAllowedAccuracyM}m). Please wait for a better GPS signal.',
          type: LocationErrorType.accuracyExceeded,
        );
      }

      return LocationData(
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyM: position.accuracy,
      );
    } on LocationAppException {
      rethrow;
    } catch (e) {
      throw LocationAppException(
        'Failed to acquire current location: ${e.toString()}',
        type: LocationErrorType.unknown,
      );
    }
  }
}
