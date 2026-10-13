# Environment Configuration

Use `.env.example` as a list of required keys. Never commit real `.env` values.

## API environment variables (initial)
```dotenv
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://attendance_app:local_dev_password@localhost:5432/attendance_dev
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=info
APP_BASE_URL=http://localhost:5173
API_BASE_URL=http://localhost:4000
# AUTH_SECRET=replace-with-generated-secret
# REFRESH_TOKEN_SECRET=replace-with-generated-secret
# OBJECT_STORAGE_PROVIDER=...
# OBJECT_STORAGE_BUCKET=...
# OBJECT_STORAGE_REGION=...
# OBJECT_STORAGE_ACCESS_KEY=...
# OBJECT_STORAGE_SECRET_KEY=...
```

These are examples only. Use local-only credentials in development and secret manager/environment injection in production. The authentication and object storage keys must be finalized after the related architecture decisions.

## Local services
- PostgreSQL should bind to localhost in development unless there is a documented reason otherwise.
- Do not expose PostgreSQL publicly.
- Use Docker Compose for reproducible local development.
- Production credentials must be distinct from development credentials.
