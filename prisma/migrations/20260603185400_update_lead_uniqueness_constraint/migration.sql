-- DropIndex
DROP INDEX `Lead_name_company_source_key` ON `Lead`;

-- CreateIndex
CREATE UNIQUE INDEX `Lead_name_company_source_agentId_key` ON `Lead`(`name`, `company`, `source`, `agentId`);
