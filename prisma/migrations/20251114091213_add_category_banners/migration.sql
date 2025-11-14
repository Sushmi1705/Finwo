-- CreateTable
CREATE TABLE "category_banners" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "main_category_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "title" TEXT,
    "linkUrl" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "category_banners_main_category_id_fkey" FOREIGN KEY ("main_category_id") REFERENCES "main_categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
