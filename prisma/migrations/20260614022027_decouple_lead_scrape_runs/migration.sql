/*
  Warnings:

  - You are about to drop the column `scrapeRunId` on the `leads` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `leads` DROP FOREIGN KEY `leads_scrapeRunId_fkey`;

-- AlterTable
ALTER TABLE `leads` DROP COLUMN `scrapeRunId`;

-- AlterTable
ALTER TABLE `project_heatmaps` MODIFY `sourceUrl` TEXT NULL;

-- CreateTable
CREATE TABLE `lead_scrape_runs` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `scrapeRunId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_scrape_runs_leadId_idx`(`leadId`),
    INDEX `lead_scrape_runs_scrapeRunId_idx`(`scrapeRunId`),
    UNIQUE INDEX `lead_scrape_runs_leadId_scrapeRunId_key`(`leadId`, `scrapeRunId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_usage_logs` (
    `id` VARCHAR(191) NOT NULL,
    `taskType` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `promptTokens` INTEGER NOT NULL DEFAULT 0,
    `completionTokens` INTEGER NOT NULL DEFAULT 0,
    `totalTokens` INTEGER NOT NULL DEFAULT 0,
    `estimatedCostUsd` DOUBLE NOT NULL DEFAULT 0,
    `inputChars` INTEGER NOT NULL DEFAULT 0,
    `truncated` BOOLEAN NOT NULL DEFAULT false,
    `success` BOOLEAN NOT NULL DEFAULT true,
    `errorMessage` TEXT NULL,
    `agentId` VARCHAR(191) NULL,
    `durationMs` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_usage_logs_createdAt_idx`(`createdAt`),
    INDEX `ai_usage_logs_taskType_idx`(`taskType`),
    INDEX `ai_usage_logs_agentId_idx`(`agentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `leads_agentId_name_company_idx` ON `leads`(`agentId`, `name`, `company`);

-- CreateIndex
CREATE INDEX `project_heatmaps_latitude_longitude_idx` ON `project_heatmaps`(`latitude`, `longitude`);

-- AddForeignKey
ALTER TABLE `lead_scrape_runs` ADD CONSTRAINT `lead_scrape_runs_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_scrape_runs` ADD CONSTRAINT `lead_scrape_runs_scrapeRunId_fkey` FOREIGN KEY (`scrapeRunId`) REFERENCES `ScrapeRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `leads` RENAME INDEX `Lead_agentId_fkey` TO `leads_agentId_fkey`;
