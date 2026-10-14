-- CreateEnum
CREATE TYPE "SelfieUploadStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'ATTACHED', 'EXPIRED');

-- CreateTable
CREATE TABLE "selfie_uploads" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "employee_id" UUID,
    "object_key" TEXT NOT NULL,
    "original_name" TEXT,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER,
    "file_hash_sha256" TEXT,
    "status" "SelfieUploadStatus" NOT NULL DEFAULT 'PENDING',
    "upload_url_expires_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "selfie_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "selfie_uploads_object_key_key" ON "selfie_uploads"("object_key");

-- CreateIndex
CREATE INDEX "selfie_uploads_company_id_user_id_status_idx" ON "selfie_uploads"("company_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "selfie_uploads_company_id_status_idx" ON "selfie_uploads"("company_id", "status");

-- CreateIndex
CREATE INDEX "selfie_uploads_upload_url_expires_at_status_idx" ON "selfie_uploads"("upload_url_expires_at", "status");

-- AddForeignKey
ALTER TABLE "selfie_uploads" ADD CONSTRAINT "selfie_uploads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selfie_uploads" ADD CONSTRAINT "selfie_uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selfie_uploads" ADD CONSTRAINT "selfie_uploads_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
