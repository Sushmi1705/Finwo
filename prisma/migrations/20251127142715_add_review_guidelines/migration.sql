-- CreateTable
CREATE TABLE "review_guidelines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT,
    "text" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "review_guidelines_key_key" ON "review_guidelines"("key");

-- CreateIndex
CREATE INDEX "review_guidelines_locale_is_active_sort_order_idx" ON "review_guidelines"("locale", "is_active", "sort_order");
