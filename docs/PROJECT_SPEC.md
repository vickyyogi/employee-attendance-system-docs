# Project Specification

## 1. Ringkasan
Membangun sistem absensi karyawan multi-perusahaan. Tiap perusahaan memiliki karyawan, lokasi kerja, jadwal, kebijakan absensi, catatan kehadiran, pengajuan cuti/izin, persetujuan, dan laporan yang terisolasi dari perusahaan lain.

## 2. Platform
- Web: React + Vite + TypeScript untuk admin, HR, dan supervisor sesuai permission.
- Mobile: Flutter untuk karyawan dan pengguna yang diberi akses.
- Backend: Express.js + TypeScript REST API.
- Database: PostgreSQL melalui Prisma.
- File: private object storage yang mendukung signed URL. Provider `OPEN` dan harus dipilih sebelum deployment.

## 3. Persona dan peran awal
- Platform Super Admin: mengelola tenant/perusahaan pada tingkat platform.
- Company Admin: mengelola konfigurasi perusahaan dan pengguna sesuai tenant.
- HR Admin: mengelola data karyawan, memproses persetujuan, dan melihat laporan sesuai izin.
- Supervisor: dapat melihat data tim jika permission diberikan; bukan approver default dalam rancangan awal.
- Employee: melakukan absensi, melihat data sendiri, dan mengajukan cuti/izin/koreksi.
- Auditor/Viewer: akses baca saja bila diberikan oleh tenant.

Role adalah preset permission, bukan pengganti pemeriksaan tenant. User dapat memiliki membership pada lebih dari satu perusahaan; setiap request harus memiliki tenant context aktif yang tervalidasi.

## 4. Fitur MVP
1. Tenant/perusahaan dan membership.
2. Autentikasi dan manajemen sesi/token.
3. Data karyawan, departemen, jabatan.
4. Lokasi kerja dan geofence.
5. Shift dan kalender hari libur.
6. Check-in/check-out dengan GPS, geofence, selfie, server timestamp.
7. Riwayat absensi pribadi dan dashboard HR.
8. Pengajuan cuti/izin dan koreksi absensi dengan persetujuan HR/admin.
9. Laporan dan export yang dibatasi permission.
10. Audit log untuk aktivitas penting.
11. Dokumentasi API dan pengujian otomatis.

## 5. Di luar MVP kecuali disetujui
- Payroll penuh dan integrasi bank.
- Integrasi perangkat biometrik atau mesin absensi.
- Face recognition/liveness detection.
- Offline attendance yang dipercaya sebagai bukti final.
- Penghitungan lembur kompleks, payroll, pajak, atau regulasi khusus yang belum didefinisikan.
- Notifikasi SMS/WhatsApp berbayar.
- Native iOS release jika belum menjadi target peluncuran.

## 6. Prinsip non-fungsional
- Tenant isolation wajib diuji.
- HTTPS di semua environment selain loopback development.
- Audit perubahan penting.
- Data pribadi dibatasi berdasarkan kebutuhan kerja.
- Database backup dan prosedur restore sebelum production.
- API memiliki validation, pagination, error handling, dan rate limiting.
- Waktu resmi absensi berasal dari server.
- Desain dapat berkembang tanpa harus memecah backend menjadi microservices.

## 7. Open questions sebelum production
- Provider object storage dan region penyimpanan.
- Kebijakan retensi selfie, koordinat, audit log, dan data karyawan.
- Durasi sesi, refresh token, dan prosedur pemulihan akun.
- Aturan shift lintas tengah malam, grace period, keterlambatan, dan absensi berulang.
- Apakah perlu multi-session dalam satu hari.
- Peraturan ketenagakerjaan, privasi, dan persetujuan pemrosesan data yang berlaku bagi organisasi.
- Apakah tenant boleh memiliki beberapa zona waktu.
- Mekanisme ekspor, format laporan, dan batas periode laporan.
