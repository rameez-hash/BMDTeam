/*
  Warnings:

  - You are about to drop the column `designation_id` on the `employees` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `employees` DROP FOREIGN KEY `employees_designation_id_fkey`;

-- AlterTable
ALTER TABLE `attendance` ADD COLUMN `modified_at` DATETIME(3) NULL,
    ADD COLUMN `modified_by_id` VARCHAR(191) NULL,
    ADD COLUMN `modify_reason` TEXT NULL,
    ADD COLUMN `shift_end_time` VARCHAR(191) NULL,
    ADD COLUMN `shift_name` VARCHAR(191) NULL,
    ADD COLUMN `shift_start_time` VARCHAR(191) NULL,
    ADD COLUMN `work_location` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `employees` DROP COLUMN `designation_id`,
    ADD COLUMN `app_role_id` VARCHAR(191) NULL,
    ADD COLUMN `designation` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `shifts` ADD COLUMN `checkout_grace` INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN `early_checkin_grace` INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN `min_checkin_gap` INTEGER NOT NULL DEFAULT 180,
    ADD COLUMN `standard_work_hours` DOUBLE NOT NULL DEFAULT 9;

-- AlterTable
ALTER TABLE `tax_slabs` ADD COLUMN `fixed_tax` DOUBLE NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `payroll_settings` (
    `id` VARCHAR(191) NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `attendance_lock_day` INTEGER NOT NULL DEFAULT 0,
    `is_attendance_locked` BOOLEAN NOT NULL DEFAULT false,
    `attendance_locked_at` DATETIME(3) NULL,
    `payroll_closing_day` INTEGER NOT NULL DEFAULT 5,
    `payroll_due_date` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payroll_settings_month_year_key`(`month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manual_deductions` (
    `id` VARCHAR(191) NOT NULL,
    `payroll_record_id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `type` ENUM('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'LEAVE_REQUEST', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'PAYROLL_GENERATED', 'PAYROLL_PAID', 'ATTENDANCE_CORRECTION', 'ANNOUNCEMENT', 'ONBOARDING', 'OVERTIME', 'DOCUMENT') NOT NULL DEFAULT 'INFO',
    `module` VARCHAR(191) NULL,
    `resource_id` VARCHAR(191) NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_is_read_idx`(`user_id`, `is_read`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_templates` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_template_items` (
    `id` VARCHAR(191) NOT NULL,
    `template_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'General',
    `is_required` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboardings` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `template_id` VARCHAR(191) NULL,
    `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE') NOT NULL DEFAULT 'IN_PROGRESS',
    `start_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `due_date` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `assigned_by_id` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_items` (
    `id` VARCHAR(191) NOT NULL,
    `onboarding_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'General',
    `is_required` BOOLEAN NOT NULL DEFAULT true,
    `is_completed` BOOLEAN NOT NULL DEFAULT false,
    `completed_at` DATETIME(3) NULL,
    `completed_by_id` VARCHAR(191) NULL,
    `document_url` VARCHAR(191) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `overtime_rules` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `min_overtime_minutes` INTEGER NOT NULL DEFAULT 30,
    `regular_rate` DOUBLE NOT NULL DEFAULT 1.5,
    `weekend_rate` DOUBLE NOT NULL DEFAULT 2.0,
    `holiday_rate` DOUBLE NOT NULL DEFAULT 2.5,
    `max_daily_hours` DOUBLE NOT NULL DEFAULT 4,
    `max_monthly_hours` DOUBLE NOT NULL DEFAULT 60,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `overtime_records` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `overtime_hours` DOUBLE NOT NULL,
    `overtime_type` ENUM('REGULAR', 'WEEKEND', 'HOLIDAY') NOT NULL DEFAULT 'REGULAR',
    `rate_multiplier` DOUBLE NOT NULL DEFAULT 1.5,
    `status` ENUM('PENDING', 'AUTO_APPROVED', 'MANUALLY_APPROVED', 'REJECTED') NOT NULL DEFAULT 'AUTO_APPROVED',
    `approved_by_id` VARCHAR(191) NULL,
    `approved_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `overtime_records_employee_id_date_key`(`employee_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_roles` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(191) NULL DEFAULT '#6B7280',
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `app_roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `permissions_module_action_key`(`module`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `role_id` VARCHAR(191) NOT NULL,
    `permission_id` VARCHAR(191) NOT NULL,
    `scope` ENUM('ALL', 'DEPARTMENT', 'SELF') NOT NULL DEFAULT 'SELF',

    UNIQUE INDEX `role_permissions_role_id_permission_id_key`(`role_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `permission_id` VARCHAR(191) NOT NULL,
    `scope` ENUM('ALL', 'DEPARTMENT', 'SELF') NOT NULL DEFAULT 'SELF',
    `granted` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `employee_permissions_employee_id_permission_id_key`(`employee_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_app_role_id_fkey` FOREIGN KEY (`app_role_id`) REFERENCES `app_roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manual_deductions` ADD CONSTRAINT `manual_deductions_payroll_record_id_fkey` FOREIGN KEY (`payroll_record_id`) REFERENCES `payroll_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_template_items` ADD CONSTRAINT `onboarding_template_items_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `onboarding_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboardings` ADD CONSTRAINT `onboardings_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `onboarding_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_items` ADD CONSTRAINT `onboarding_items_onboarding_id_fkey` FOREIGN KEY (`onboarding_id`) REFERENCES `onboardings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `app_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_permissions` ADD CONSTRAINT `employee_permissions_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_permissions` ADD CONSTRAINT `employee_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
