-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_shops" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "description" TEXT,
    "review_description" TEXT,
    "address" TEXT,
    "city" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "phone_number" TEXT,
    "website_url" TEXT,
    "chat_link" TEXT,
    "open_hours" TEXT,
    "avgRating" REAL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "shops_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "main_categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_shops" ("address", "avgRating", "category_id", "chat_link", "city", "created_at", "description", "id", "latitude", "logo_url", "longitude", "name", "open_hours", "phone_number", "review_count", "review_description", "website_url") SELECT "address", "avgRating", "category_id", "chat_link", "city", "created_at", "description", "id", "latitude", "logo_url", "longitude", "name", "open_hours", "phone_number", "review_count", "review_description", "website_url" FROM "shops";
DROP TABLE "shops";
ALTER TABLE "new_shops" RENAME TO "shops";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
