-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('IN_PROGRESS', 'PRESENT', 'LATE', 'FLAGGED', 'CORRECTED');

-- CreateEnum
CREATE TYPE "AttendanceEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'CORRECTION', 'FLAG');

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "shift_id" UUID,
    "work_location_id" UUID,
    "check_in_at" TIMESTAMPTZ,
    "check_out_at" TIMESTAMPTZ,
    "check_in_latitude" DECIMAL(10,7),
    "check_in_longitude" DECIMAL(10,7),
    "check_in_accuracy_m" INTEGER,
    "check_in_distance_m" INTEGER,
    "check_in_geofence_valid" BOOLEAN,
    "check_in_selfie_object_key" TEXT,
    "check_out_latitude" DECIMAL(10,7),
    "check_out_longitude" DECIMAL(10,7),
    "check_out_accuracy_m" INTEGER,
    "check_out_distance_m" INTEGER,
    "check_out_geofence_valid" BOOLEAN,
    "check_out_selfie_object_key" TEXT,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "idempotency_key" TEXT,
    "flag_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_events" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "attendance_record_id" UUID NOT NULL,
    "event_type" "AttendanceEventType" NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_records_company_id_work_date_idx" ON "attendance_records"("company_id", "work_date");

-- CreateIndex
CREATE INDEX "attendance_records_company_id_employee_id_idx" ON "attendance_records"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "attendance_records_company_id_status_idx" ON "attendance_records"("company_id", "status");

-- CreateIndex
CREATE INDEX "attendance_records_company_id_idempotency_key_idx" ON "attendance_records"("company_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_company_id_employee_id_work_date_key" ON "attendance_records"("company_id", "employee_id", "work_date");

-- CreateIndex
CREATE INDEX "attendance_events_company_id_attendance_record_id_idx" ON "attendance_events"("company_id", "attendance_record_id");

-- CreateIndex
CREATE INDEX "attendance_events_company_id_event_type_idx" ON "attendance_events"("company_id", "event_type");

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "work_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
