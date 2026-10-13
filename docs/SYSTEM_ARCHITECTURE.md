# System Architecture

## Architectural style
Monorepo dengan modular monolith untuk API. Web, mobile, dan API memiliki build serta dependency masing-masing. REST API `/api/v1` adalah kontrak bersama. Hindari microservices pada MVP.

## Final repository structure
```text
employee-attendance-system/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── app.ts
│   │   │   ├── server.ts
│   │   │   ├── config/
│   │   │   ├── common/
│   │   │   │   ├── errors/
│   │   │   │   ├── middleware/
│   │   │   │   ├── validators/
│   │   │   │   └── utils/
│   │   │   ├── infrastructure/
│   │   │   │   ├── database/
│   │   │   │   ├── logger/
│   │   │   │   ├── storage/
│   │   │   │   └── email/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── companies/
│   │   │   │   ├── memberships/
│   │   │   │   ├── users/
│   │   │   │   ├── employees/
│   │   │   │   ├── departments/
│   │   │   │   ├── positions/
│   │   │   │   ├── work-locations/
│   │   │   │   ├── shifts/
│   │   │   │   ├── holidays/
│   │   │   │   ├── attendance/
│   │   │   │   ├── leave/
│   │   │   │   ├── attendance-corrections/
│   │   │   │   ├── approvals/
│   │   │   │   ├── reports/
│   │   │   │   └── audit-logs/
│   │   │   ├── routes/
│   │   │   └── tests/
│   │   ├── test/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   └── web/
│       ├── public/
│       ├── src/
│       │   ├── app/
│       │   │   ├── router.tsx
│       │   │   └── providers.tsx
│       │   ├── components/
│       │   │   ├── ui/
│       │   │   ├── layout/
│       │   │   └── data-table/
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   ├── company-switcher/
│       │   │   ├── dashboard/
│       │   │   ├── employees/
│       │   │   ├── departments/
│       │   │   ├── work-locations/
│       │   │   ├── shifts/
│       │   │   ├── attendance/
│       │   │   ├── leave/
│       │   │   ├── approvals/
│       │   │   ├── reports/
│       │   │   └── settings/
│       │   ├── lib/
│       │   │   ├── api-client.ts
│       │   │   └── utils.ts
│       │   ├── hooks/
│       │   ├── types/
│       │   └── main.tsx
│       ├── package.json
│       └── vite.config.ts
├── apps/mobile/
│   ├── android/
│   ├── ios/
│   ├── assets/
│   ├── lib/
│   │   ├── main.dart
│   │   ├── app/
│   │   │   ├── app.dart
│   │   │   └── router.dart
│   │   ├── core/
│   │   │   ├── config/
│   │   │   ├── network/
│   │   │   ├── storage/
│   │   │   ├── errors/
│   │   │   └── widgets/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── company-selection/
│   │   │   ├── home/
│   │   │   ├── attendance/
│   │   │   ├── history/
│   │   │   ├── leave/
│   │   │   ├── schedule/
│   │   │   └── profile/
│   │   └── shared/
│   ├── test/
│   └── pubspec.yaml
├── packages/
│   ├── api-contracts/
│   ├── eslint-config/
│   └── typescript-config/
├── infrastructure/
│   ├── docker/
│   ├── compose.yaml
│   └── deployment/
├── docs/
├── .github/workflows/
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── AGENTS.md
└── README.md
```

Note: `apps/mobile` adalah Flutter project dan dapat menggunakan toolchain Flutter tersendiri. npm workspaces tidak mengelola dependency Dart.

## Module layering (API)
Setiap domain module dapat berisi:
- `*.routes.ts`: endpoint dan middleware.
- `*.controller.ts`: HTTP request/response.
- `*.service.ts`: aturan bisnis dan transaksi.
- `*.repository.ts`: query Prisma.
- `*.schema.ts`: validasi input.
- `*.types.ts`: tipe domain.
- `*.test.ts`: unit/integration tests.

Jangan membuat file kosong untuk semua modul sejak awal. Buat saat tahap implementasi modul terkait.

## Tenant context
1. User login.
2. API mengidentifikasi user.
3. User memilih company dari daftar membership aktifnya.
4. Backend memvalidasi membership dan membentuk tenant context.
5. Service/repository memakai tenant context untuk seluruh operasi data tenant.
6. Setiap endpoint menguji bahwa resource berada di tenant aktif.

Jangan mempercayai `companyId` dari body sebagai otorisasi. Jika company ID ada di URL/header, tetap validasi membership di server.

## API request flow
Client -> HTTPS -> authentication middleware -> tenant context middleware -> permission middleware -> schema validation -> controller -> service -> repository/Prisma -> PostgreSQL.

## File storage
Selfie disimpan pada private object storage. API membuat upload URL bertanda tangan berumur pendek atau menerima upload melalui endpoint yang membatasi ukuran/tipe. Server memverifikasi object key, tenant, pemilik, MIME type, ukuran, dan status upload. Jangan mengembalikan public URL permanen.

## Deployment boundaries
- Web static hosting/CDN atau web server.
- API service terpisah dari web static hosting.
- PostgreSQL tidak diekspos ke internet publik.
- Object storage private.
- Secret disimpan di secret manager/environment deployment.
- Reverse proxy/load balancer terminasi TLS dan meneruskan request tepercaya.
