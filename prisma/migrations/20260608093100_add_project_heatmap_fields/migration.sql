-- AlterTable
ALTER TABLE `project_heatmaps` ADD COLUMN `areaSqft` INTEGER NULL,
    ADD COLUMN `imageUrl` TEXT NULL,
    ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL;
