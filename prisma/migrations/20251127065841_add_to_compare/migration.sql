-- CreateTable
CREATE TABLE "CompareList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "sessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CompareItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "compareId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompareItem_compareId_fkey" FOREIGN KEY ("compareId") REFERENCES "CompareList" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompareItem_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CompareList_userId_key" ON "CompareList"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompareList_sessionId_key" ON "CompareList"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompareItem_compareId_shopId_key" ON "CompareItem"("compareId", "shopId");
