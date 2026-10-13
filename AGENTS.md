# Instructions for AI Coding Agent

## Misi
Implementasikan sistem absensi karyawan sesuai dokumentasi repository. Dokumentasi adalah sumber kebutuhan dan keputusan. Jangan menciptakan aturan bisnis baru tanpa mencatatnya sebagai pertanyaan terbuka.

## Urutan baca wajib
1. `README.md`
2. `docs/PROJECT_SPEC.md`
3. `docs/PRD.md`
4. `docs/SYSTEM_ARCHITECTURE.md`
5. `docs/DECISIONS.md`
6. `docs/DATABASE_ERD.md`
7. `docs/DATABASE_SCHEMA.md`
8. `docs/API_SPECIFICATION.md`
9. `docs/ROLE_PERMISSION_MATRIX.md`
10. `docs/ATTENDANCE_WORKFLOW.md`
11. `docs/SECURITY_SPEC.md`
12. `docs/TESTING_STRATEGY.md`
13. `docs/IMPLEMENTATION_PLAN.md`

## Aturan satu tahap per sesi — WAJIB
- Kerjakan hanya satu tahap yang secara eksplisit ditugaskan dalam sesi saat ini.
- Jika pengguna belum memilih tahap, kerjakan Stage 0 saja.
- Stage 0 adalah audit dan perencanaan; jangan mengubah kode aplikasi, menjalankan migrasi, atau membuat implementasi fitur.
- Jangan otomatis melanjutkan ke tahap berikutnya meskipun tahap aktif selesai lebih cepat.
- Jika tahap memiliki sub-tahap, kerjakan hanya sub-tahap yang ditugaskan.
- Setelah tahap selesai, berhenti dan tunggu instruksi pengguna.

## Sebelum bekerja
1. Periksa struktur repository, branch, status Git, dan perubahan yang belum di-commit.
2. Jangan menimpa atau menghapus pekerjaan pengguna.
3. Cocokkan kondisi repository dengan dokumen dan catat konflik atau keputusan yang belum ada.
4. Identifikasi kriteria penerimaan dan tes untuk tahap aktif.
5. Jika informasi penting belum tersedia, ajukan pertanyaan atau catat sebagai blocker; jangan menebak.

## Aturan implementasi
- Ikuti struktur folder dan boundary modul pada `SYSTEM_ARCHITECTURE.md`.
- Gunakan TypeScript strict mode pada API dan web.
- Gunakan Prisma migrations untuk perubahan schema. Jangan mengubah database production secara manual.
- Validasi semua input yang berasal dari klien.
- Terapkan tenant scoping di backend pada setiap query data tenant.
- Jangan percaya `company_id`, role, status approval, waktu resmi, atau hasil geofence yang dikirim klien tanpa verifikasi server.
- Semua endpoint privat harus memerlukan autentikasi dan otorisasi.
- Jangan mengembalikan password hash, token, object key privat, atau data tenant lain.
- Jangan menaruh selfie atau dokumen privat di direktori publik.
- Jangan membuat fitur tambahan di luar scope tahap aktif.
- Hindari abstraksi berlebihan dan dependency baru tanpa alasan jelas.
- Gunakan environment variables untuk konfigurasi dan sediakan `.env.example` tanpa secret.
- Tulis tes untuk aturan bisnis, otorisasi, dan kasus error yang relevan.
- Jangan menonaktifkan tes/lint/typecheck untuk membuat build terlihat lulus.

## Database dan migrasi
- Buat migration yang dapat ditinjau.
- Jangan reset, drop, atau menghapus data database yang sudah ada tanpa persetujuan eksplisit.
- Seed hanya data development/demo yang tidak berisi data personal nyata.
- Tambahkan constraint/index untuk invariant penting; validasi di aplikasi saja tidak cukup untuk semua kasus.

## API
- Gunakan response/error format yang konsisten.
- Versioning API dimulai dari `/api/v1`.
- Update OpenAPI saat endpoint berubah.
- Perubahan kontrak API harus mempertimbangkan klien web dan mobile.
- Gunakan pagination pada endpoint daftar yang berpotensi besar.

## Security & privacy
- Ikuti `SECURITY_SPEC.md`.
- Log tidak boleh menyimpan password, bearer token, selfie, atau koordinat presisi kecuali kebutuhan audit yang disetujui dan dilindungi.
- Batasi akses selfie berdasarkan tenant dan permission.
- Terapkan rate limit untuk autentikasi dan endpoint sensitif.
- Jangan menyatakan GPS/selfie sebagai bukti anti-fraud sempurna.

## Kriteria selesai tiap tahap
Tahap hanya dianggap selesai bila:
1. Kriteria penerimaan tahap terpenuhi.
2. Tes yang relevan lulus, atau kegagalan dijelaskan dengan bukti.
3. Lint dan typecheck terkait lulus, bila sudah tersedia.
4. Dokumentasi/API/schema diperbarui jika diperlukan.
5. Tidak ada secret yang ditambahkan ke repository.
6. Perubahan tidak melewati scope tahap aktif.

## Laporan akhir sesi wajib
Gunakan format:
- **Tahap yang dikerjakan:**
- **Ringkasan:**
- **File dibuat/diubah:**
- **Tes yang dijalankan dan hasil:**
- **Keputusan/asumsi:**
- **Risiko atau blocker:**
- **Langkah berikutnya yang disarankan:** (jangan dijalankan otomatis)

Setelah laporan, berhenti. Jangan mulai tahap selanjutnya sebelum pengguna memberi instruksi baru.
