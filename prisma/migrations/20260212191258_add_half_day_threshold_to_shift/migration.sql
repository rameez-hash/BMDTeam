-- AlterTable
ALTER TABLE `shifts` ADD COLUMN `auto_half_day` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `half_day_threshold_mins` INTEGER NOT NULL DEFAULT 240;
