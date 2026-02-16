-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_employee_id_key`(`employee_id`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `employee_code` VARCHAR(191) NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `date_of_birth` DATETIME(3) NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL,
    `marital_status` ENUM('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED') NULL,
    `blood_group` VARCHAR(191) NULL,
    `nationality` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `zip_code` VARCHAR(191) NULL,
    `profile_image` VARCHAR(191) NULL,
    `department_id` VARCHAR(191) NULL,
    `designation_id` VARCHAR(191) NULL,
    `shift_id` VARCHAR(191) NULL,
    `reporting_manager_id` VARCHAR(191) NULL,
    `joining_date` DATETIME(3) NULL,
    `confirmation_date` DATETIME(3) NULL,
    `resignation_date` DATETIME(3) NULL,
    `relieving_date` DATETIME(3) NULL,
    `employment_status` ENUM('ACTIVE', 'ON_NOTICE', 'RESIGNED', 'TERMINATED', 'ON_LEAVE') NOT NULL DEFAULT 'ACTIVE',
    `employment_type` ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'PROBATION') NOT NULL DEFAULT 'FULL_TIME',
    `bank_name` VARCHAR(191) NULL,
    `bank_account_number` VARCHAR(191) NULL,
    `ifsc_code` VARCHAR(191) NULL,
    `pan_number` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employees_user_id_key`(`user_id`),
    UNIQUE INDEX `employees_employee_code_key`(`employee_code`),
    UNIQUE INDEX `employees_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `parent_id` VARCHAR(191) NULL,
    `head_id` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `departments_name_key`(`name`),
    UNIQUE INDEX `departments_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `designations` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `department_id` VARCHAR(191) NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `designations_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shifts` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `start_time` VARCHAR(191) NOT NULL,
    `end_time` VARCHAR(191) NOT NULL,
    `break_duration` INTEGER NOT NULL DEFAULT 60,
    `grace_time` INTEGER NOT NULL DEFAULT 15,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shifts_name_key`(`name`),
    UNIQUE INDEX `shifts_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `education` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `degree` VARCHAR(191) NOT NULL,
    `institution` VARCHAR(191) NOT NULL,
    `board` VARCHAR(191) NULL,
    `field_of_study` VARCHAR(191) NULL,
    `start_year` INTEGER NULL,
    `end_year` INTEGER NULL,
    `grade` VARCHAR(191) NULL,
    `percentage` DOUBLE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experience` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `company_name` VARCHAR(191) NOT NULL,
    `job_title` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NULL,
    `is_current` BOOLEAN NOT NULL DEFAULT false,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `emergency_contacts` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `relationship` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `check_in` DATETIME(3) NULL,
    `check_out` DATETIME(3) NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND') NOT NULL DEFAULT 'PRESENT',
    `is_late` BOOLEAN NOT NULL DEFAULT false,
    `late_minutes` INTEGER NOT NULL DEFAULT 0,
    `work_hours` DOUBLE NULL,
    `overtime` DOUBLE NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `attendance_employee_id_date_key`(`employee_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_breaks` (
    `id` VARCHAR(191) NOT NULL,
    `attendance_id` VARCHAR(191) NOT NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NULL,
    `duration` INTEGER NULL,
    `reason` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_corrections` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `original_check_in` DATETIME(3) NULL,
    `original_check_out` DATETIME(3) NULL,
    `requested_check_in` DATETIME(3) NULL,
    `requested_check_out` DATETIME(3) NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `approved_by_id` VARCHAR(191) NULL,
    `approved_at` DATETIME(3) NULL,
    `rejection_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_types` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `annual_allocation` INTEGER NOT NULL DEFAULT 0,
    `is_prorated_on_join` BOOLEAN NOT NULL DEFAULT true,
    `is_carry_forward` BOOLEAN NOT NULL DEFAULT false,
    `max_carry_forward` INTEGER NOT NULL DEFAULT 0,
    `is_paid` BOOLEAN NOT NULL DEFAULT true,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leave_types_name_key`(`name`),
    UNIQUE INDEX `leave_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_requests` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `leave_type_id` VARCHAR(191) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `total_days` DOUBLE NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `approved_by_id` VARCHAR(191) NULL,
    `approved_at` DATETIME(3) NULL,
    `rejection_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_balances` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `leave_type_id` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `total_days` DOUBLE NOT NULL,
    `used_days` DOUBLE NOT NULL DEFAULT 0,
    `pending_days` DOUBLE NOT NULL DEFAULT 0,
    `carry_forward` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leave_balances_employee_id_leave_type_id_year_key`(`employee_id`, `leave_type_id`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salaries` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `basic_salary` DOUBLE NOT NULL,
    `hra` DOUBLE NOT NULL DEFAULT 0,
    `da` DOUBLE NOT NULL DEFAULT 0,
    `ta` DOUBLE NOT NULL DEFAULT 0,
    `medical_allowance` DOUBLE NOT NULL DEFAULT 0,
    `other_allowances` DOUBLE NOT NULL DEFAULT 0,
    `pf` DOUBLE NOT NULL DEFAULT 0,
    `esi` DOUBLE NOT NULL DEFAULT 0,
    `professional_tax` DOUBLE NOT NULL DEFAULT 0,
    `tds` DOUBLE NOT NULL DEFAULT 0,
    `other_deductions` DOUBLE NOT NULL DEFAULT 0,
    `gross_salary` DOUBLE NOT NULL,
    `net_salary` DOUBLE NOT NULL,
    `effective_from` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `salaries_employee_id_key`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_history` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `basic_salary` DOUBLE NOT NULL,
    `gross_salary` DOUBLE NOT NULL,
    `net_salary` DOUBLE NOT NULL,
    `effective_from` DATE NOT NULL,
    `effective_to` DATE NULL,
    `reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_records` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `working_days` INTEGER NOT NULL,
    `present_days` DOUBLE NOT NULL,
    `leave_days` DOUBLE NOT NULL,
    `absent_days` DOUBLE NOT NULL,
    `late_days` INTEGER NOT NULL,
    `basic_salary` DOUBLE NOT NULL,
    `hra` DOUBLE NOT NULL DEFAULT 0,
    `da` DOUBLE NOT NULL DEFAULT 0,
    `ta` DOUBLE NOT NULL DEFAULT 0,
    `medical_allowance` DOUBLE NOT NULL DEFAULT 0,
    `other_allowances` DOUBLE NOT NULL DEFAULT 0,
    `overtime` DOUBLE NOT NULL DEFAULT 0,
    `bonus` DOUBLE NOT NULL DEFAULT 0,
    `pf` DOUBLE NOT NULL DEFAULT 0,
    `esi` DOUBLE NOT NULL DEFAULT 0,
    `professional_tax` DOUBLE NOT NULL DEFAULT 0,
    `tds` DOUBLE NOT NULL DEFAULT 0,
    `late_deduction` DOUBLE NOT NULL DEFAULT 0,
    `other_deductions` DOUBLE NOT NULL DEFAULT 0,
    `manual_deduction` DOUBLE NOT NULL DEFAULT 0,
    `deduction_reason` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `payment_reference` VARCHAR(191) NULL,
    `gross_earnings` DOUBLE NOT NULL,
    `total_deductions` DOUBLE NOT NULL,
    `net_salary` DOUBLE NOT NULL,
    `status` ENUM('DRAFT', 'PROCESSED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payroll_records_employee_id_month_year_key`(`employee_id`, `month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tax_slabs` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `min_income` DOUBLE NOT NULL,
    `max_income` DOUBLE NULL,
    `tax_rate` DOUBLE NOT NULL,
    `year` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `late_rules` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `min_late_count` INTEGER NOT NULL,
    `max_late_count` INTEGER NULL,
    `deduction_type` ENUM('PERCENTAGE', 'FIXED', 'DAYS') NOT NULL,
    `deduction_value` DOUBLE NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcements` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `type` ENUM('GENERAL', 'POLICY', 'EVENT', 'HOLIDAY', 'BIRTHDAY', 'ACHIEVEMENT') NOT NULL DEFAULT 'GENERAL',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `publish_date` DATETIME(3) NOT NULL,
    `expiry_date` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `holidays` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `type` ENUM('PUBLIC', 'COMPANY', 'RESTRICTED') NOT NULL DEFAULT 'PUBLIC',
    `is_optional` BOOLEAN NOT NULL DEFAULT false,
    `description` TEXT NULL,
    `year` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `holidays_date_name_key`(`date`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `resource_id` VARCHAR(191) NULL,
    `description` TEXT NOT NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` TEXT NULL,
    `old_data` JSON NULL,
    `new_data` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_documents` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `document_type` ENUM('NIC', 'PASSPORT', 'DRIVING_LICENSE', 'BANK_STATEMENT', 'EDUCATION_CERTIFICATE', 'EXPERIENCE_LETTER', 'MEDICAL_REPORT', 'OTHER') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `file_type` VARCHAR(191) NOT NULL,
    `uploaded_by` VARCHAR(191) NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `description` TEXT NULL,
    `is_approved` BOOLEAN NOT NULL DEFAULT false,
    `approved_by` VARCHAR(191) NULL,
    `approved_at` DATETIME(3) NULL,
    `expiry_date` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assigned_documents` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `file_type` VARCHAR(191) NOT NULL,
    `assigned_by` VARCHAR(191) NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiry_date` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tax_certificates` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `financial_year` VARCHAR(191) NOT NULL,
    `total_income` DOUBLE NOT NULL,
    `total_tax_paid` DOUBLE NOT NULL,
    `certificate_no` VARCHAR(191) NULL,
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `file_path` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tax_certificates_employee_id_key`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_designation_id_fkey` FOREIGN KEY (`designation_id`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_reporting_manager_id_fkey` FOREIGN KEY (`reporting_manager_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designations` ADD CONSTRAINT `designations_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `education` ADD CONSTRAINT `education_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience` ADD CONSTRAINT `experience_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emergency_contacts` ADD CONSTRAINT `emergency_contacts_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_breaks` ADD CONSTRAINT `attendance_breaks_attendance_id_fkey` FOREIGN KEY (`attendance_id`) REFERENCES `attendance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_corrections` ADD CONSTRAINT `attendance_corrections_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_corrections` ADD CONSTRAINT `attendance_corrections_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_balances` ADD CONSTRAINT `leave_balances_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_balances` ADD CONSTRAINT `leave_balances_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salaries` ADD CONSTRAINT `salaries_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_history` ADD CONSTRAINT `salary_history_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_records` ADD CONSTRAINT `payroll_records_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_documents` ADD CONSTRAINT `employee_documents_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assigned_documents` ADD CONSTRAINT `assigned_documents_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tax_certificates` ADD CONSTRAINT `tax_certificates_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
