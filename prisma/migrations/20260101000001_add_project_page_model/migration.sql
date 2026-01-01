-- CreateTable
CREATE TABLE "ProjectPage" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "cmsId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "pageType" TEXT,
    "hasRedirect" BOOLEAN NOT NULL DEFAULT false,
    "redirectUrl" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastModifiedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPage_projectId_cmsId_key" ON "ProjectPage"("projectId", "cmsId");

-- CreateIndex
CREATE INDEX "ProjectPage_projectId_url_idx" ON "ProjectPage"("projectId", "url");

-- AddForeignKey
ALTER TABLE "ProjectPage" ADD CONSTRAINT "ProjectPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "IndexingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
