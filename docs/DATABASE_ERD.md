# Database ERD

## Entity relationships
```mermaid
erDiagram
  USERS ||--o{ COMPANY_MEMBERSHIPS : has
  COMPANIES ||--o{ COMPANY_MEMBERSHIPS : includes
  COMPANIES ||--o{ EMPLOYEES : employs
  USERS ||--o| EMPLOYEES : may_link
  COMPANIES ||--o{ DEPARTMENTS : owns
  COMPANIES ||--o{ POSITIONS : owns
  DEPARTMENTS ||--o{ EMPLOYEES : groups
  POSITIONS ||--o{ EMPLOYEES : assigns
  COMPANIES ||--o{ WORK_LOCATIONS : defines
  COMPANIES ||--o{ SHIFTS : defines
  EMPLOYEES ||--o{ EMPLOYEE_SHIFTS : assigned
  SHIFTS ||--o{ EMPLOYEE_SHIFTS : assigned
  COMPANIES ||--o{ HOLIDAYS : defines
  EMPLOYEES ||--o{ ATTENDANCE_RECORDS : records
  WORK_LOCATIONS ||--o{ ATTENDANCE_RECORDS : location
  SHIFTS ||--o{ ATTENDANCE_RECORDS : planned_shift
  ATTENDANCE_RECORDS ||--o{ ATTENDANCE_EVENTS : has
  EMPLOYEES ||--o{ LEAVE_REQUESTS : submits
  LEAVE_TYPES ||--o{ LEAVE_REQUESTS : classifies
  EMPLOYEES ||--o{ ATTENDANCE_CORRECTION_REQUESTS : submits
  USERS ||--o{ APPROVAL_ACTIONS : performs
  COMPANIES ||--o{ AUDIT_LOGS : records
```

## Relationship notes
- `users` adalah identitas global; `company_memberships` memberi akses user ke tenant tertentu.
- `employees` adalah record ketenagakerjaan dalam satu perusahaan dan dapat terhubung ke user.
- Semua tabel tenant-scoped harus menyertakan `company_id`, langsung atau melalui relasi yang divalidasi.
- `attendance_records` pada MVP memakai satu record per employee per work date. Multi-sesi kerja dalam satu hari adalah keputusan terbuka; jika diperlukan, ubah model sebelum implementasi attendance.
- Selfie metadata disimpan pada attendance record/event; binary foto berada di private object storage.
- Approval action menyimpan siapa yang memutuskan, kapan, keputusan, dan catatan.
