/*
  Warnings:

  - You are about to alter the `SourceConfig` table. Adding a non-null column `verificationStatus` would add a NOT NULL constraint on the table, but the table has rows which contain NULL values in that column. If you want to add a NOT NULL with a default value to an existing table, you need to handle the data migration.

*/
-- AlterTable
ALTER TABLE `SourceConfig` ADD COLUMN `verificationStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
    ADD COLUMN `verificationReport` JSON,
    ADD COLUMN `verifiedAt` DATETIME(3),
    ADD COLUMN `technicalAccessPassed` BOOLEAN,
    ADD COLUMN `domDataPassed` BOOLEAN,
    ADD COLUMN `interactionsPassed` BOOLEAN,
    ADD COLUMN `aiExtractionPassed` BOOLEAN,
    ADD COLUMN `verificationNotes` LONGTEXT;
