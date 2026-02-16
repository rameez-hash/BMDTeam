-- AlterTable
ALTER TABLE `attendance` ADD COLUMN `shift_work_days` JSON NULL;

-- AlterTable
ALTER TABLE `employee_documents` ADD COLUMN `document_field_id` VARCHAR(191) NULL,
    MODIFY `document_type` ENUM('NIC', 'PASSPORT', 'DRIVING_LICENSE', 'BANK_STATEMENT', 'EDUCATION_CERTIFICATE', 'EXPERIENCE_LETTER', 'MEDICAL_REPORT', 'OTHER') NULL;

-- AlterTable
ALTER TABLE `notifications` ADD COLUMN `link` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `payroll_records` ADD COLUMN `absent_deduction` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `shifts` ADD COLUMN `work_days` JSON NOT NULL;

-- CreateTable
CREATE TABLE `document_fields` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `is_required` BOOLEAN NOT NULL DEFAULT false,
    `employee_can_edit` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `document_fields_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employee_documents` ADD CONSTRAINT `employee_documents_document_field_id_fkey` FOREIGN KEY (`document_field_id`) REFERENCES `document_fields`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
