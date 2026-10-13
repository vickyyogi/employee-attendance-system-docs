# Local Infrastructure

Panduan menjalankan infrastruktur lokal untuk pengembangan sistem absensi karyawan.

## PostgreSQL Local (Docker)

Menjalankan PostgreSQL menggunakan Docker Compose:
```bash
docker compose -f infrastructure/compose.yaml up -d
```

Mengecek log container:
```bash
docker compose -f infrastructure/compose.yaml logs -f
```

Menghentikan container:
```bash
docker compose -f infrastructure/compose.yaml down
```

### Konfigurasi Default
- **Host:** `localhost`
- **Port:** `5432`
- **User:** `attendance_app`
- **Password:** `local_dev_password`
- **Database:** `attendance_dev`
- **Connection URL:** `postgresql://attendance_app:local_dev_password@localhost:5432/attendance_dev`
