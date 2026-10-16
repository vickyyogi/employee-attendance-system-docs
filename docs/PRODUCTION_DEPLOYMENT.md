# Production Deployment and Operations Guide

This document defines the deployment topology, containerization, security configuration, disaster recovery, and operational procedures for the Multi-Tenant Employee Attendance System in production environments.

---

## 1. Production Architecture Topology

```mermaid
flowchart TD
    subgraph Clients["Clients"]
        Mobile["Flutter Mobile App (Android / iOS)"]
        WebBrowser["React Web Dashboard (Browser)"]
    end

    subgraph Edge["Edge & Security Layer"]
        CDN["Cloudflare / Edge CDN (WAF & DDoS Protection)"]
        Nginx["Nginx Reverse Proxy (TLS 1.3, Rate Limiting, Security Headers)"]
    end

    subgraph Application["Application Layer (Docker Cluster)"]
        API1["Express API Instance 1 (@attendance/api)"]
        API2["Express API Instance 2 (@attendance/api)"]
    end

    subgraph Persistence["Persistence & Storage Layer"]
        PgBouncer["PgBouncer (Connection Pooler)"]
        Postgres[("Managed PostgreSQL 15+ (Primary with Hot Standby)")]
        S3[("Private S3 Object Storage (AWS S3 / MinIO / Cloudflare R2)")]
    end

    Mobile -->|HTTPS /api/v1| CDN
    WebBrowser -->|HTTPS Static Assets & API| CDN
    CDN --> Nginx
    Nginx -->|Proxy Pass /api/v1| API1
    Nginx -->|Proxy Pass /api/v1| API2
    API1 --> PgBouncer
    API2 --> PgBouncer
    PgBouncer --> Postgres
    API1 -->|Pre-signed URLs / S3 SDK| S3
    API2 -->|Pre-signed URLs / S3 SDK| S3
    Mobile -->|Direct Pre-signed Binary Upload / Read| S3
    WebBrowser -->|Direct Pre-signed Read| S3
```

---

## 2. Infrastructure & Containerization

### 2.1 Backend API Container (`apps/api/Dockerfile`)
The backend is packaged into an unprivileged, multi-stage Alpine Node.js container:

```dockerfile
# Multi-stage production Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat openssl

# Install workspace dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/api-contracts/package.json ./packages/api-contracts/
RUN npm ci

# Copy contracts, Prisma schema and source
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build contracts, generate Prisma client, and compile TypeScript
RUN npm run build --workspace @attendance/api-contracts
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace @attendance/api

# Production runtime stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
RUN apk add --no-cache dumb-init openssl

# Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 attendance
USER attendance

COPY --from=builder --chown=attendance:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=attendance:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=attendance:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=attendance:nodejs /app/packages ./packages
COPY --from=builder --chown=attendance:nodejs /app/package.json ./package.json

EXPOSE 3000
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "apps/api/dist/src/index.js"]
```

### 2.2 Web Dashboard Nginx Hosting (`apps/web`)
The React SPA is built via `npm run build --workspace @attendance/web` and served as static files behind Nginx:

```nginx
server {
    listen 80;
    server_name attendance.company.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name attendance.company.com;

    ssl_certificate /etc/letsencrypt/live/attendance.company.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/attendance.company.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    root /var/www/attendance-web/dist;
    index index.html;

    # Static asset caching
    location ~* \.(?:css|js|jpg|jpeg|gif|png|ico|cur|gz|svg|svgz|mp4|ogg|ogv|webm|htc|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA Client-Side Routing Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse proxy API requests to Express API cluster
    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;
    }
}
```

---

## 3. Production Environment & Configuration Matrix

Every production deployment must define the following environment variables in a protected secrets manager (AWS Secrets Manager, HashiCorp Vault, or Azure Key Vault). **Never store `.env` in Git.**

| Variable | Requirement | Description / Production Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Mandatory | `production` |
| `PORT` | Mandatory | `3000` (or target container port) |
| `DATABASE_URL` | Mandatory | `postgresql://user:pass@pgbouncer:6432/attendance_prod?sslmode=require&connection_limit=25` |
| `JWT_ACCESS_SECRET` | Mandatory | Cryptographically random string (min 64 chars / 256 bits) |
| `JWT_REFRESH_SECRET` | Mandatory | Cryptographically random string (min 64 chars / 256 bits) |
| `JWT_ACCESS_EXPIRY` | Optional | `15m` (access token lifespan) |
| `JWT_REFRESH_EXPIRY_DAYS` | Optional | `30` (refresh token rotation lifespan) |
| `STORAGE_PROVIDER` | Mandatory | `s3` (enables S3-compatible cloud storage) |
| `S3_BUCKET_NAME` | Mandatory | e.g. `company-attendance-selfies-prod` |
| `S3_REGION` | Mandatory | e.g. `ap-southeast-1` (Jakarta/Singapore) |
| `S3_ENDPOINT` | Optional | Custom endpoint if using MinIO or Cloudflare R2 |
| `AWS_ACCESS_KEY_ID` | Mandatory | Least-privilege IAM service account |
| `AWS_SECRET_ACCESS_KEY` | Mandatory | Least-privilege IAM service key |
| `CORS_ALLOWED_ORIGINS` | Mandatory | Comma-separated domains (e.g. `https://attendance.company.com`) — **No wildcards** |
| `RATE_LIMIT_WINDOW_MS` | Optional | `900000` (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | Optional | `100` (per IP window for general endpoints; auth has stricter thresholds) |
| `LOG_LEVEL` | Optional | `info` (or `warn` in high-throughput environments) |

---

## 4. Private Object Storage Policy (S3)

Selfie images contain sensitive biometric employee data. Direct public access is strictly prohibited.

### 4.1 S3 Bucket Policy (Enforce Private Access & TLS)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EnforceTLSRequestsOnly",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::company-attendance-selfies-prod",
        "arn:aws:s3:::company-attendance-selfies-prod/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

### 4.2 S3 Lifecycle Rules
Configure AWS S3 / R2 Lifecycle configurations to manage operational cost and compliance:
- **Abort incomplete multipart uploads:** 1 day.
- **Unattached / Expired Upload Intents:** Pruned after 30 days.
- **Transition to Glacier/Cold Storage:** 365 days (1 year) for archived attendance selfies.

---

## 5. Database Operations, Migrations & Disaster Recovery

### 5.1 Production Migration Runbook
All database schema changes are managed via Prisma migrations.
1. **Pre-deployment Migration Check:**
   ```bash
   npx prisma migrate status --schema=apps/api/prisma/schema.prisma
   ```
2. **Execute Pending Migrations (CI/CD Pipeline Gate):**
   ```bash
   npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
   ```
   > [!IMPORTANT]
   > Never run `prisma migrate dev` or `prisma db push` in production or staging environments.
   > Always test migrations against a staging replica with production-like data volume before applying to production.

### 5.2 Automated Backup, Integrity Verification & Restore Drill
The repository includes an automated disaster recovery utility: `scripts/db-backup-restore.ps1`.

1. **Daily Compressed Backup with SHA-256 Checksum:**
   ```powershell
   .\scripts\db-backup-restore.ps1 -Action backup -BackupDir "/var/backups/postgres" -KeepBackups 14
   ```
2. **Backup Archive Integrity Verification:**
   ```powershell
   .\scripts\db-backup-restore.ps1 -Action verify -BackupFile "/var/backups/postgres/attendance_prod_latest.dump"
   ```
3. **Automated Monthly Restore Drill Verification:**
   ```powershell
   .\scripts\db-backup-restore.ps1 -Action restore-drill -DrillDatabase "attendance_restore_drill"
   ```
   *The script creates an isolated drill database, restores all schemas and tables, validates row count consistency, and cleanly cleans up, proving 100% recoverability.*

### 5.3 Disaster Recovery SLAs
- **Recovery Point Objective (RPO):** <= 24 hours via daily snapshots (RPO <= 15 minutes when PostgreSQL Write-Ahead Log (WAL) archiving / Point-In-Time-Recovery (PITR) is activated via AWS RDS / pgBackRest).
- **Recovery Time Objective (RTO):** <= 2 hours for full database restore from snapshot.

---

## 6. Observability, Health Checking & Alerting

### 6.1 Health Probes
The backend exposes a standard health probe:
- **Endpoint:** `GET /api/v1/health`
- **Response Format:**
  ```json
  {
    "data": {
      "status": "ok",
      "timestamp": "2026-10-16T12:00:00.000Z"
    }
  }
  ```
- **Liveness Probe:** Interval 15s, Timeout 5s, Failure threshold 3.
- **Readiness Probe:** Executes `SELECT 1` on PostgreSQL to confirm active connection pool availability.

### 6.2 Critical Alerting Thresholds
| Metric | Condition | Severity | Action |
| :--- | :--- | :--- | :--- |
| **API 5xx Error Spike** | > 1% of total requests over 5 min | Critical | PagerDuty alert; inspect structured error logs |
| **Database Pool Saturation** | Active connections > 85% of pool max | Warning | Scale PgBouncer or investigate connection leaks |
| **API Latency (P95)** | > 500ms over 10 min | Warning | Check slow query log and index usage |
| **Storage Upload Failures** | > 3 consecutive S3 signed upload errors | High | Check IAM credential validity and S3 bucket health |
| **Disk Space Usage** | Host storage > 80% capacity | High | Trigger automated log/backup rotation |

---

## 7. Incident Response & Secret Rotation

1. **JWT Secret Compromise:**
   - Update `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in Secrets Manager.
   - Restart the API cluster. All active access tokens will immediately become invalid.
   - Truncate the `refresh_tokens` table in PostgreSQL to force global re-authentication.
2. **Tenant Data Breach or Suspected Leak:**
   - Immediately suspend the affected user or company membership via `company_memberships.status = SUSPENDED`.
   - Inspect immutable audit logs queryable via `/api/v1/audit-logs` filtering by `companyId` and timestamp.
   - If personal data was breached, initiate the mandatory notification protocol to the Indonesian Data Protection Authority (Lembaga PDP) within 72 hours (UU PDP Art. 46).
