import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:attendance_mobile/core/errors/app_exceptions.dart';
import 'package:attendance_mobile/core/location/location_service.dart';
import 'mocks/mock_services.dart';

void main() {
  group('Location Service & GPS Policy Tests', () {
    late MockLocationService locationService;

    setUp(() {
      locationService = MockLocationService();
    });

    test('Throws serviceDisabled when location services are disabled on device', () async {
      locationService.serviceEnabled = false;

      expect(
        () => locationService.getCurrentLocation(maxAllowedAccuracyM: 50),
        throwsA(
          predicate((e) =>
              e is LocationAppException && e.type == LocationErrorType.serviceDisabled),
        ),
      );
    });

    test('Throws permissionDenied when user denies location permission', () async {
      locationService.permission = LocationPermission.denied;

      expect(
        () => locationService.getCurrentLocation(maxAllowedAccuracyM: 50),
        throwsA(
          predicate((e) =>
              e is LocationAppException && e.type == LocationErrorType.permissionDenied),
        ),
      );
    });

    test('Throws permissionDeniedForever when location permission is permanently denied', () async {
      locationService.permission = LocationPermission.deniedForever;

      expect(
        () => locationService.getCurrentLocation(maxAllowedAccuracyM: 50),
        throwsA(
          predicate((e) =>
              e is LocationAppException &&
              e.type == LocationErrorType.permissionDeniedForever),
        ),
      );
    });

    test('Throws accuracyExceeded when reported GPS accuracy exceeds threshold', () async {
      // Simulate low-accuracy GPS reading (accuracy = 120m, max allowable = 50m)
      locationService.mockLocation = const LocationData(
        latitude: -6.2088,
        longitude: 106.8456,
        accuracyM: 120.0,
      );

      expect(
        () => locationService.getCurrentLocation(maxAllowedAccuracyM: 50),
        throwsA(
          predicate((e) =>
              e is LocationAppException && e.type == LocationErrorType.accuracyExceeded),
        ),
      );
    });

    test('Returns location when GPS accuracy is within threshold', () async {
      locationService.mockLocation = const LocationData(
        latitude: -6.2088,
        longitude: 106.8456,
        accuracyM: 15.0,
      );

      final loc = await locationService.getCurrentLocation(maxAllowedAccuracyM: 50);

      expect(loc.latitude, -6.2088);
      expect(loc.longitude, 106.8456);
      expect(loc.accuracyM, 15.0);
    });
  });
}
