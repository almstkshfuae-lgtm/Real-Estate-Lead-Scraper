-- AlterTable
ALTER TABLE `ScrapeRun` MODIFY `sources` TEXT NOT NULL,
    MODIFY `criteria` TEXT NOT NULL;

-- RenameIndex
ALTER TABLE `leads` RENAME INDEX `Lead_source_idx` TO `leads_source_idx`;
