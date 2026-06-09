-- AlterTable
ALTER TABLE `leads` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NULL,
    `details` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entityId_idx`(`entityId`),
    INDEX `audit_logs_agentId_idx`(`agentId`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `leads_createdAt_idx` ON `leads`(`createdAt`);
CREATE INDEX `leads_status_idx` ON `leads`(`status`);
CREATE INDEX `leads_tier_idx` ON `leads`(`tier`);
CREATE INDEX `leads_score_idx` ON `leads`(`score`);
CREATE INDEX `leads_location_idx` ON `leads`(`location`);
