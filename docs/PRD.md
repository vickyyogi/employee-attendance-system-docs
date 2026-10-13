# Product Requirements Document (PRD)

## Problem
Perusahaan membutuhkan cara terpusat untuk merekam kehadiran karyawan melalui smartphone dan mengelolanya melalui web. Sistem harus mendukung lebih dari satu perusahaan tanpa kebocoran data antarperusahaan.

## Goals
- Karyawan dapat melakukan check-in dan check-out dari mobile.
- Check-in/check-out memuat lokasi GPS, hasil validasi geofence, dan referensi selfie.
- HR/admin dapat mengelola karyawan, jadwal, lokasi kerja, persetujuan, dan laporan.
- Perusahaan hanya dapat mengakses data tenant sendiri.
- Aktivitas administratif dan koreksi dapat diaudit.

## Primary user stories
- Sebagai karyawan, saya dapat login dan memilih perusahaan aktif tempat saya memiliki membership.
- Sebagai karyawan, saya dapat melihat shift dan status kehadiran hari ini.
- Sebagai karyawan, saya dapat melakukan check-in/out dengan izin kamera dan lokasi yang relevan.
- Sebagai karyawan, saya dapat melihat riwayat absensi sendiri.
- Sebagai karyawan, saya dapat mengajukan cuti/izin dan koreksi dengan alasan.
- Sebagai HR/admin, saya dapat membuat dan memperbarui data karyawan, lokasi, shift, dan hari libur.
- Sebagai HR/admin, saya dapat menyetujui atau menolak pengajuan dan menuliskan catatan keputusan.
- Sebagai HR/admin, saya dapat memfilter dan mengekspor laporan yang diizinkan.
- Sebagai platform admin, saya dapat mengelola perusahaan tanpa otomatis memperoleh akses ke seluruh konten privat tenant kecuali permission dan prosedur audit mengizinkannya.

## Functional requirements
### Identity and tenancy
- FR-001: Semua endpoint privat memerlukan identitas terautentikasi.
- FR-002: Request harus menggunakan tenant context yang berasal dari membership aktif dan diverifikasi server.
- FR-003: Pengguna tanpa membership aktif tidak dapat mengakses data perusahaan.
- FR-004: Admin platform dan admin tenant memiliki scope yang berbeda.

### Attendance
- FR-010: Backend menetapkan timestamp resmi check-in/out.
- FR-011: Backend memvalidasi lokasi kerja, jarak geofence, akurasi GPS, dan kebijakan tenant.
- FR-012: Selfie harus diunggah melalui alur upload privat yang aman dan diverifikasi sebelum absensi diterima.
- FR-013: Permintaan duplikat harus ditangani secara idempotent atau ditolak secara konsisten.
- FR-014: Klien tidak boleh mengirim nilai status final seperti `LATE` atau `APPROVED`.
- FR-015: Sistem menyimpan hasil validasi dan metadata bukti yang diperlukan tanpa mengklaim anti-fraud sempurna.

### Requests and approvals
- FR-020: Cuti/izin dan koreksi absensi memiliki status workflow.
- FR-021: HR/admin tenant dengan permission dapat approve/reject.
- FR-022: Pemohon tidak dapat menyetujui pengajuannya sendiri.
- FR-023: Keputusan menyimpan approver, timestamp, dan catatan.

### Reporting and audit
- FR-030: Daftar dan laporan selalu tenant-scoped.
- FR-031: Export dibatasi permission dan dicatat di audit log.
- FR-032: Perubahan data karyawan, kebijakan, absensi, dan keputusan persetujuan diaudit.

## Non-functional requirements
- NFR-001: TypeScript strict mode pada backend dan web.
- NFR-002: Validasi server-side untuk seluruh input.
- NFR-003: Tidak ada secret dalam Git.
- NFR-004: HTTPS untuk komunikasi production.
- NFR-005: Tes otomatis untuk tenant isolation, permission, dan alur absensi.
- NFR-006: Backup dan restore database diuji sebelum peluncuran.
- NFR-007: Data pribadi disimpan hanya selama periode yang ditetapkan organisasi dan hukum yang berlaku.

## MVP acceptance criteria
- User dari Company A tidak dapat membaca, mengubah, atau menghapus data Company B, termasuk melalui ID yang ditebak.
- Absensi yang di luar geofence ditolak atau ditandai sesuai kebijakan yang disetujui; kebijakan default harus ditentukan sebelum production.
- Timestamp resmi berasal dari server.
- Foto selfie tidak dapat diakses publik.
- Hanya HR/admin yang berpermission dapat menyetujui cuti/izin/koreksi.
- Semua endpoint kritis memiliki tes sukses, validasi, otorisasi, dan error path.
