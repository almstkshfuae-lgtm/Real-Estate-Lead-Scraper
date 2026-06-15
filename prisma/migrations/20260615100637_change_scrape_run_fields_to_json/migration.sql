/*
  Warnings:

  - You are about to alter the column `sources` on the `ScrapeRun` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Json`.
  - You are about to alter the column `criteria` on the `ScrapeRun` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Json`.

*/
-- AlterTable
ALTER TABLE `ScrapeRun` MODIFY `sources` JSON NOT NULL,
    MODIFY `criteria` JSON NOT NULL;
