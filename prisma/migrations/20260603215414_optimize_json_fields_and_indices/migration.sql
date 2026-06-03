/*
  Warnings:

  - You are about to alter the column `signals` on the `Lead` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Json`.
  - You are about to alter the column `propertyPref` on the `Lead` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `signals` on the `SourceConfig` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Json`.
  - You are about to alter the column `navigationSelectors` on the `SourceConfig` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Json`.
  - You are about to alter the column `contentSelectors` on the `SourceConfig` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Json`.

*/
-- AlterTable
ALTER TABLE `Lead` MODIFY `signals` JSON NOT NULL,
    MODIFY `propertyPref` JSON NOT NULL;

-- AlterTable
ALTER TABLE `SourceConfig` MODIFY `signals` JSON NOT NULL,
    MODIFY `navigationSelectors` JSON NOT NULL,
    MODIFY `contentSelectors` JSON NOT NULL;

-- CreateIndex
CREATE INDEX `Lead_source_idx` ON `Lead`(`source`);
