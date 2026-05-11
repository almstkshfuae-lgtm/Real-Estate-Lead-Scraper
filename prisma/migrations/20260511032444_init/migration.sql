-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'agent',
    `theme` VARCHAR(191) NOT NULL DEFAULT 'system',
    `language` VARCHAR(191) NOT NULL DEFAULT 'en',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NULL,
    `company` VARCHAR(191) NOT NULL,
    `companyAr` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL,
    `roleAr` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL,
    `tier` INTEGER NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `location` VARCHAR(191) NOT NULL,
    `score` INTEGER NOT NULL,
    `signals` JSON NOT NULL,
    `propertyPref` JSON NOT NULL,
    `budgetMin` DOUBLE NULL,
    `budgetMax` DOUBLE NULL,
    `relocated` BOOLEAN NOT NULL DEFAULT false,
    `rentalFlag` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NOT NULL DEFAULT 'new',
    `notes` VARCHAR(191) NULL,
    `bitrix24Id` VARCHAR(191) NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `scrapeRunId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScrapeRun` (
    `id` VARCHAR(191) NOT NULL,
    `triggeredBy` VARCHAR(191) NOT NULL,
    `sources` JSON NOT NULL,
    `criteria` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `leadsFound` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Search` (
    `id` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `criteria` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessage` (
    `id` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_scrapeRunId_fkey` FOREIGN KEY (`scrapeRunId`) REFERENCES `ScrapeRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Search` ADD CONSTRAINT `Search_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
