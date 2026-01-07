-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "automationStatus" TEXT;
ALTER TABLE "Lead" ADD COLUMN "meetingId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "nextMeetingAt" DATETIME;

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" INTEGER,
    "entityName" TEXT,
    "description" TEXT NOT NULL,
    "details" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "projectId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "patrickAccess" TEXT NOT NULL DEFAULT 'HIDDEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" DATETIME,
    "lastLoginIp" TEXT
);

-- CreateTable
CREATE TABLE "LoginLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IndexingProject" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "domain" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "platform" TEXT
);

-- CreateTable
CREATE TABLE "ProjectAccess" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IndexingUrl" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "interval" TEXT,
    "lastSubmittedAt" DATETIME,
    "nextSubmitAt" DATETIME,
    "lastInspectionResult" TEXT,
    "lastInspectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastCrawledAt" DATETIME,
    CONSTRAINT "IndexingUrl_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IndexingLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "urlId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "userName" TEXT,
    CONSTRAINT "IndexingLog_urlId_fkey" FOREIGN KEY ("urlId") REFERENCES "IndexingUrl" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoogleOAuthToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "scope" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GoogleDocsToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "leadId" INTEGER,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentGeneratorConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guidelines" TEXT,
    "aiRules" TEXT,
    "llmProvider" TEXT NOT NULL DEFAULT 'openai',
    "llmModel" TEXT NOT NULL DEFAULT 'gpt-4',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "brandStatement" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "cmsAppPassword" TEXT,
    "cmsType" TEXT,
    "cmsUrl" TEXT,
    "cmsUsername" TEXT,
    "shopifyStore" TEXT,
    "shopifyToken" TEXT,
    "cmsApiKey" TEXT,
    CONSTRAINT "ProjectSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectAppAccess" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accessId" INTEGER NOT NULL,
    "appType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectAppAccess_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "ProjectAccess" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedContent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "title" TEXT,
    "contentType" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "useGuidelines" BOOLEAN NOT NULL DEFAULT true,
    "useAiRules" BOOLEAN NOT NULL DEFAULT true,
    "conversation" TEXT,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "llmPrompt" TEXT,
    CONSTRAINT "GeneratedContent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GeneratedContent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalyticsCounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PatrickClick" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clickedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hour" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "date" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "LinkBuildingKeyword" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "keyword" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pageTypes" TEXT,
    "onlyFirst" BOOLEAN NOT NULL DEFAULT true,
    "onlyFirstP" BOOLEAN NOT NULL DEFAULT false,
    "linksCreated" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LinkBuildingKeyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LinkBuildingLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "keywordId" INTEGER NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "pageTitle" TEXT,
    "anchorId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageId" INTEGER,
    "linkedCount" INTEGER,
    "redirectUrl" TEXT,
    CONSTRAINT "LinkBuildingLog_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "LinkBuildingKeyword" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LinkBuildingLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiscoveredPageType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "typeName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DiscoveredPageType_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JarvisConnection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "connectorType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "credentials" TEXT NOT NULL,
    "config" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JarvisConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JarvisFlow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nodes" TEXT NOT NULL,
    "edges" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "webhookId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JarvisFlow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JarvisExecution" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "flowId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "triggerType" TEXT,
    "triggerData" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "JarvisExecution_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "JarvisFlow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JarvisLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "executionId" INTEGER NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeName" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" TEXT,
    "output" TEXT,
    "error" TEXT,
    "duration" INTEGER,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JarvisLog_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "JarvisExecution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectPage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "cmsId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "pageType" TEXT,
    "hasRedirect" BOOLEAN NOT NULL DEFAULT false,
    "redirectUrl" TEXT,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastModifiedAt" DATETIME,
    CONSTRAINT "ProjectPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectMedia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "wpId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "alt" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "filesize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "parentPostId" INTEGER,
    "parentPostTitle" TEXT,
    "parentPostUrl" TEXT,
    "parentPostType" TEXT,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalUrl" TEXT,
    CONSTRAINT "ProjectMedia_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediaChangeLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mediaId" INTEGER NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaChangeLog_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "ProjectMedia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageFactoryLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageFactoryLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageFactorySnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "heavyCount" INTEGER NOT NULL,
    "missingAltCount" INTEGER NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageFactorySnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PageImage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sizeKB" REAL NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "pages" TEXT NOT NULL,
    "optimized" BOOLEAN NOT NULL DEFAULT false,
    "lastScannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PageImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Workflow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "executionMode" TEXT NOT NULL DEFAULT 'AUTO',
    "pipelineStage" TEXT,
    "triggerType" TEXT NOT NULL,
    "triggerStatus" TEXT,
    "triggerSubStatus" TEXT,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "cancelOnStatus" TEXT,
    "cancelOnSubStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Workflow" ("cancelOnStatus", "cancelOnSubStatus", "createdAt", "description", "id", "isActive", "name", "requireApproval", "triggerStatus", "triggerSubStatus", "triggerType", "updatedAt") SELECT "cancelOnStatus", "cancelOnSubStatus", "createdAt", "description", "id", "isActive", "name", "requireApproval", "triggerStatus", "triggerSubStatus", "triggerType", "updatedAt" FROM "Workflow";
DROP TABLE "Workflow";
ALTER TABLE "new_Workflow" RENAME TO "Workflow";
CREATE TABLE "new_AppSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppSettings" ("id", "key", "updatedAt", "value") SELECT "id", "key", "updatedAt", "value" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
CREATE UNIQUE INDEX "AppSettings_key_key" ON "AppSettings"("key");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "IndexingProject_slug_key" ON "IndexingProject"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAccess_userId_projectId_key" ON "ProjectAccess"("userId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "IndexingUrl_projectId_url_key" ON "IndexingUrl"("projectId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSettings_projectId_key" ON "ProjectSettings"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAppAccess_accessId_appType_key" ON "ProjectAppAccess"("accessId", "appType");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsCounter_key_key" ON "AnalyticsCounter"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredPageType_projectId_typeName_key" ON "DiscoveredPageType"("projectId", "typeName");

-- CreateIndex
CREATE UNIQUE INDEX "JarvisFlow_webhookId_key" ON "JarvisFlow"("webhookId");

-- CreateIndex
CREATE INDEX "ProjectPage_projectId_url_idx" ON "ProjectPage"("projectId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPage_projectId_cmsId_key" ON "ProjectPage"("projectId", "cmsId");

-- CreateIndex
CREATE INDEX "ProjectMedia_projectId_parentPostType_idx" ON "ProjectMedia"("projectId", "parentPostType");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMedia_projectId_wpId_key" ON "ProjectMedia"("projectId", "wpId");

-- CreateIndex
CREATE INDEX "ImageFactoryLog_projectId_idx" ON "ImageFactoryLog"("projectId");

-- CreateIndex
CREATE INDEX "ImageFactoryLog_action_idx" ON "ImageFactoryLog"("action");

-- CreateIndex
CREATE INDEX "ImageFactoryLog_createdAt_idx" ON "ImageFactoryLog"("createdAt");

-- CreateIndex
CREATE INDEX "ImageFactorySnapshot_projectId_recordedAt_idx" ON "ImageFactorySnapshot"("projectId", "recordedAt");

-- CreateIndex
CREATE INDEX "PageImage_projectId_idx" ON "PageImage"("projectId");

-- CreateIndex
CREATE INDEX "PageImage_projectId_optimized_idx" ON "PageImage"("projectId", "optimized");

-- CreateIndex
CREATE UNIQUE INDEX "PageImage_projectId_url_key" ON "PageImage"("projectId", "url");
