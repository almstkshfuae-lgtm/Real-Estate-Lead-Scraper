-- Rename Lead table to leads (safe rename — preserves all data)
-- `Lead` is a reserved word in MySQL 8.0+ causing syntax errors in raw SQL queries.
-- Using RENAME TABLE instead of DROP+CREATE to keep all existing rows intact.

-- Step 1: Drop foreign key constraints that reference the old table name
ALTER TABLE `Lead` DROP FOREIGN KEY `Lead_agentId_fkey`;
ALTER TABLE `Lead` DROP FOREIGN KEY `Lead_scrapeRunId_fkey`;

-- Step 2: Rename the table (zero data loss)
RENAME TABLE `Lead` TO `leads`;

-- Step 3: Re-add foreign key constraints pointing to the renamed table
ALTER TABLE `leads` ADD CONSTRAINT `leads_agentId_fkey`
  FOREIGN KEY (`agentId`) REFERENCES `User`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `leads` ADD CONSTRAINT `leads_scrapeRunId_fkey`
  FOREIGN KEY (`scrapeRunId`) REFERENCES `ScrapeRun`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
