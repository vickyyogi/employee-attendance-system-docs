-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED');

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID,
    "employee_number" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "department_id" UUID,
    "position_id" UUID,
    "manager_employee_id" UUID,
    "employment_status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "hire_date" DATE,
    "termination_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employees_company_id_employment_status_idx" ON "employees"("company_id", "employment_status");

-- CreateIndex
CREATE INDEX "employees_company_id_department_id_idx" ON "employees"("company_id", "department_id");

-- CreateIndex
CREATE INDEX "employees_company_id_position_id_idx" ON "employees"("company_id", "position_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_company_id_employee_number_key" ON "employees"("company_id", "employee_number");

-- CreateIndex
CREATE UNIQUE INDEX "employees_company_id_user_id_key" ON "employees"("company_id", "user_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
