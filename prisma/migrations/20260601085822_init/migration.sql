-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "role" TEXT NOT NULL DEFAULT 'agent',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preferences" TEXT
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "company" TEXT NOT NULL,
    "companyAr" TEXT,
    "role" TEXT NOT NULL,
    "roleAr" TEXT,
    "source" TEXT NOT NULL,
    "sourceType" TEXT,
    "tier" INTEGER NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "location" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "signals" TEXT NOT NULL,
    "propertyPref" TEXT NOT NULL,
    "budgetMin" REAL,
    "budgetMax" REAL,
    "relocated" BOOLEAN NOT NULL DEFAULT false,
    "rentalFlag" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "persona" TEXT,
    "bitrix24Id" TEXT,
    "agentId" TEXT NOT NULL,
    "scrapeRunId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lead_scrapeRunId_fkey" FOREIGN KEY ("scrapeRunId") REFERENCES "ScrapeRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourceConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "signals" TEXT NOT NULL,
    "navigationSelectors" TEXT NOT NULL,
    "contentSelectors" TEXT NOT NULL,
    "crawlDepth" INTEGER,
    "maxPages" INTEGER,
    "delayBetweenPages" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "verificationReport" TEXT,
    "verifiedAt" DATETIME,
    "technicalAccessPassed" BOOLEAN,
    "domDataPassed" BOOLEAN,
    "interactionsPassed" BOOLEAN,
    "aiExtractionPassed" BOOLEAN,
    "verificationNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "triggeredBy" TEXT NOT NULL,
    "sources" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "leadsFound" INTEGER NOT NULL DEFAULT 0,
    "logUrl" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Search" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Search_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExportHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExportHistory_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Lead_agentId_fkey" ON "Lead"("agentId");

-- CreateIndex
CREATE INDEX "Lead_scrapeRunId_fkey" ON "Lead"("scrapeRunId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_name_company_source_key" ON "Lead"("name", "company", "source");

-- CreateIndex
CREATE UNIQUE INDEX "SourceConfig_key_key" ON "SourceConfig"("key");

-- CreateIndex
CREATE INDEX "Search_agentId_fkey" ON "Search"("agentId");

-- CreateIndex
CREATE INDEX "ChatMessage_agentId_fkey" ON "ChatMessage"("agentId");

-- CreateIndex
CREATE INDEX "ExportHistory_agentId_idx" ON "ExportHistory"("agentId");

-- CreateIndex
CREATE INDEX "Notification_agentId_idx" ON "Notification"("agentId");
