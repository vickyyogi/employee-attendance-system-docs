# Attendance Mobile App (Flutter)

Aplikasi mobile untuk karyawan melakukan pencatatan kehadiran (check-in/check-out) dengan verifikasi lokasi (GPS/geofence) dan foto selfie, serta pengajuan cuti/izin dan melihat jadwal shift.

## Prasyarat Lingkungan
- Flutter SDK `>=3.0.0 <4.0.0`
- Dart SDK
- Android Studio / Xcode untuk emulator dan build native

## Struktur Folder Target
Sesuai rancangan pada `docs/SYSTEM_ARCHITECTURE.md`:
```text
apps/mobile/
├── assets/
├── lib/
│   ├── main.dart
│   ├── app/
│   │   ├── app.dart
│   │   └── router.dart
│   ├── core/
│   │   ├── config/
│   │   ├── network/
│   │   ├── storage/
│   │   ├── errors/
│   │   └── widgets/
│   ├── features/
│   │   ├── auth/
│   │   ├── company-selection/
│   │   ├── home/
│   │   ├── attendance/
│   │   ├── history/
│   │   ├── leave/
│   │   ├── schedule/
│   │   └── profile/
│   └── shared/
├── test/
└── pubspec.yaml
```

## Menjalankan Aplikasi
```bash
cd apps/mobile
flutter pub get
flutter run
```
