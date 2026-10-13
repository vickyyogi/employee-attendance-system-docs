# Employee Attendance System

Sistem absensi karyawan multi-perusahaan dengan aplikasi web dan mobile.

## Stack
- Backend: Node.js, Express.js, TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Web: React, Vite, TypeScript
- Mobile: Flutter / Dart
- API: REST, JSON, OpenAPI
- Validasi: Zod pada backend
- Testing: Vitest atau Jest, Supertest, Flutter Test, React Testing Library
- Local infrastructure: Docker Compose

## Tujuan
Menyediakan sistem untuk mengelola perusahaan, karyawan, lokasi kerja, shift, absensi GPS/geofencing/selfie, pengajuan cuti/izin, koreksi absensi, persetujuan HR/admin, dan laporan.

## Prinsip wajib
1. Semua data operasional perusahaan harus terisolasi berdasarkan tenant.
2. Backend adalah sumber kebenaran untuk aturan bisnis dan waktu resmi absensi.
3. Klien tidak boleh menentukan sendiri status terlambat, validitas geofence, atau hasil persetujuan.
4. Foto selfie disimpan pada private object storage; database hanya menyimpan metadata dan object key.
5. Jangan menyimpan secret, token, atau data pribadi sensitif di Git/log.
6. AI Coding Agent hanya boleh mengerjakan satu tahap dalam satu sesi dan harus berhenti setelah tahap tersebut selesai.

## Dokumentasi
Baca `AGENTS.md` terlebih dahulu, lalu dokumen sesuai urutan dalam `AGENTS.md`.

## Repository layout
Lihat `docs/SYSTEM_ARCHITECTURE.md` untuk struktur final dan tanggung jawab setiap aplikasi.

## Perintah Monorepo
- **Instalasi dependensi:** `npm install`
- **Build semua paket:** `npm run build`
- **Linter:** `npm run lint`
- **Typecheck:** `npm run typecheck`
- **Menjalankan pengujian:** `npm run test`
- **Development API:** `npm run dev:api`
- **Development Web:** `npm run dev:web`
- **Database lokal (PostgreSQL):** `docker compose -f infrastructure/compose.yaml up -d`

## Status
Dokumen ini mendefinisikan rancangan awal. Semua keputusan yang ditandai `OPEN` harus dikonfirmasi sebelum fitur terkait masuk production.
