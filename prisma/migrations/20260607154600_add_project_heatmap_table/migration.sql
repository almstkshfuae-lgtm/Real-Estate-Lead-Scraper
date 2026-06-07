-- CreateTable
CREATE TABLE `project_heatmaps` (
    `id` VARCHAR(191) NOT NULL,
    `projectName` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `developer` VARCHAR(191) NULL,
    `startingPrice` DOUBLE NULL,
    `handoverDate` VARCHAR(191) NULL,
    `propertyType` VARCHAR(191) NULL,
    `sourceUrl` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `project_heatmaps_location_idx`(`location`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
