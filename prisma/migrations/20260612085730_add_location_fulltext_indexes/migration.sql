-- AlterTable
ALTER TABLE `leads` ADD COLUMN `locationAr` VARCHAR(191) NULL;

-- CreateIndex
CREATE FULLTEXT INDEX `leads_location_fulltext_idx` ON `leads`(`location`);

-- CreateIndex
CREATE FULLTEXT INDEX `leads_location_ar_fulltext_idx` ON `leads`(`locationAr`);

-- CreateIndex
CREATE FULLTEXT INDEX `project_heatmaps_location_fulltext_idx` ON `project_heatmaps`(`location`);

-- RenameIndex
ALTER TABLE `leads` RENAME INDEX `leads_location_idx` TO `leads_location_btree_idx`;

-- RenameIndex
ALTER TABLE `project_heatmaps` RENAME INDEX `project_heatmaps_location_idx` TO `project_heatmaps_location_btree_idx`;
