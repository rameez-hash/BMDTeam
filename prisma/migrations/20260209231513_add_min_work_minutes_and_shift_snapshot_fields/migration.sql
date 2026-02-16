-- AlterTable
ALTER TABLE `attendance` ADD COLUMN `shift_break_duration` INTEGER NULL,
    ADD COLUMN `shift_grace_time` INTEGER NULL,
    ADD COLUMN `shift_standard_work_hours` DOUBLE NULL;

-- AlterTable
ALTER TABLE `shifts` ADD COLUMN `min_work_minutes` INTEGER NOT NULL DEFAULT 240;
