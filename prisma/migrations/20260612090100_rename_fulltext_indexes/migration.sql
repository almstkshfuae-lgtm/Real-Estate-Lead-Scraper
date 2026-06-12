-- RenameIndex
ALTER TABLE `leads` RENAME INDEX `leads_location_ar_fulltext_idx` TO `leads_locationAr_idx`;

-- RenameIndex
ALTER TABLE `leads` RENAME INDEX `leads_location_fulltext_idx` TO `leads_location_idx`;

-- RenameIndex
ALTER TABLE `project_heatmaps` RENAME INDEX `project_heatmaps_location_fulltext_idx` TO `project_heatmaps_location_idx`;
