-- AlterTable
ALTER TABLE "payroll_records" ADD COLUMN IF NOT EXISTS "is_manual" BOOLEAN NOT NULL DEFAULT false;
