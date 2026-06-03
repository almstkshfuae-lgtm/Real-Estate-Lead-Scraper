-- DropForeignKey
ALTER TABLE `Lead` DROP FOREIGN KEY `Lead_scrapeRunId_fkey`;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_scrapeRunId_fkey` FOREIGN KEY (`scrapeRunId`) REFERENCES `ScrapeRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
